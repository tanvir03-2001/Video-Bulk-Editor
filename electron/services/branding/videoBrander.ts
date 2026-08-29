import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  MOVING_TEXT_SPEED_PRESETS,
  type BrandingAspectRatio,
  type BrandingSide,
  type BrandingConfig,
} from '../../../shared/branding';
import { getFfmpegPath, getFfprobePath } from '../ffmpegPaths';
import { ProcessingCancelledError } from '../frameGenerator';
import { resolveCanvasLayout, type CanvasLayout, type ImageDimensions } from './canvasLayout';
import {
  buildBrandingFilterGraph,
  type SideImageOverlayPlan,
} from './filterGraph';
import { runFfmpegProcess } from './ffmpegProcess';
import { renderTextOverlayAsset } from './overlayAssets';

export interface VideoInfo {
  width: number;
  height: number;
  durationSeconds: number;
}

export interface BrandVideoOptions {
  videoPath: string;
  outputPath: string;
  config: BrandingConfig;
  /** When set, only this many seconds are rendered (preview mode). */
  previewDurationSeconds?: number;
  previewStartSeconds?: number;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
  onPercent?: (percent: number) => void;
}

export interface BrandVideoResult {
  outputPath: string;
  encoder: string;
  videoInfo: VideoInfo;
  outputWidth: number;
  outputHeight: number;
  outputAspectRatio: BrandingAspectRatio;
}

interface EncoderAttempt {
  videoArgs: string[];
  audioArgs: string[];
  label: string;
}

const HARDWARE_ENCODERS = ['h264_nvenc', 'h264_qsv', 'h264_amf'] as const;

let hardwareEncoderPromise: Promise<string | null> | null = null;

function parseRotation(stream: Record<string, unknown>): number {
  const tags = stream.tags as Record<string, unknown> | undefined;
  const tagRotate = tags?.rotate;
  if (typeof tagRotate === 'string' || typeof tagRotate === 'number') {
    const parsed = Number(tagRotate);
    if (Number.isFinite(parsed)) {
      return Math.abs(parsed) % 360;
    }
  }

  const sideData = stream.side_data_list as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(sideData)) {
    for (const entry of sideData) {
      const rotation = entry.rotation;
      if (typeof rotation === 'number' && Number.isFinite(rotation)) {
        return Math.abs(rotation) % 360;
      }
    }
  }

  return 0;
}

/**
 * Read display dimensions and duration. Rotated videos report pre-rotation
 * dimensions, so they are swapped to match what the filter graph will see.
 */
export async function probeVideoInfo(
  videoPath: string,
  shouldCancel?: () => boolean,
  registerChild?: (child: ChildProcess | null) => void,
): Promise<VideoInfo> {
  const ffprobe = getFfprobePath();
  if (!ffprobe) {
    throw new Error('ffprobe is not available');
  }

  const { stdout } = await runFfmpegProcess(
    ffprobe,
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      videoPath,
    ],
    { shouldCancel, registerChild },
  );

  let parsed: {
    streams?: Array<Record<string, unknown>>;
    format?: Record<string, unknown>;
  };

  try {
    parsed = JSON.parse(stdout) as typeof parsed;
  } catch {
    throw new Error('Unable to read video information');
  }

  const stream = parsed.streams?.[0];
  if (!stream) {
    throw new Error('No video stream found');
  }

  const rawWidth = Number(stream.width);
  const rawHeight = Number(stream.height);
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight) || rawWidth < 2 || rawHeight < 2) {
    throw new Error('Unable to read video dimensions');
  }

  const rotation = parseRotation(stream);
  const swap = rotation === 90 || rotation === 270;

  const duration = Number(parsed.format?.duration ?? stream.duration);

  return {
    width: swap ? rawHeight : rawWidth,
    height: swap ? rawWidth : rawHeight,
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 0,
  };
}

async function probeHardwareEncoder(): Promise<string | null> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    return null;
  }

  try {
    const { stdout } = await runFfmpegProcess(ffmpeg, ['-hide_banner', '-encoders']);
    for (const encoder of HARDWARE_ENCODERS) {
      if (stdout.includes(encoder)) {
        return encoder;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/** Cached per process; availability in the encoder list is still verified by actually encoding. */
export function getHardwareEncoder(): Promise<string | null> {
  if (!hardwareEncoderPromise) {
    hardwareEncoderPromise = probeHardwareEncoder();
  }
  return hardwareEncoderPromise;
}

function buildVideoEncoderArgs(encoder: string): string[] {
  switch (encoder) {
    case 'h264_nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '20', '-b:v', '0'];
    case 'h264_qsv':
      return ['-c:v', 'h264_qsv', '-global_quality', '22'];
    case 'h264_amf':
      return ['-c:v', 'h264_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', '22', '-qp_p', '24'];
    default:
      return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18'];
  }
}

async function buildEncoderAttempts(): Promise<EncoderAttempt[]> {
  const hardware = await getHardwareEncoder();
  const attempts: EncoderAttempt[] = [];

  if (hardware) {
    attempts.push({
      label: hardware,
      videoArgs: buildVideoEncoderArgs(hardware),
      audioArgs: ['-c:a', 'copy'],
    });
  }

  attempts.push({
    label: 'libx264',
    videoArgs: buildVideoEncoderArgs('libx264'),
    audioArgs: ['-c:a', 'copy'],
  });

  attempts.push({
    label: 'libx264',
    videoArgs: buildVideoEncoderArgs('libx264'),
    audioArgs: ['-c:a', 'aac', '-b:a', '192k'],
  });

  return attempts;
}

interface OverlayAssets {
  watermarkPath: string | null;
  watermarkTargetWidthPx: number | null;
  movingTextPath: string | null;
  sideImages: Array<{
    side: BrandingSide;
    path: string;
    dimensions: ImageDimensions;
  }>;
  layout: CanvasLayout;
}

async function readImageDimensions(imagePath: string): Promise<ImageDimensions> {
  const sharpModule = await import('sharp');
  const metadata = await sharpModule.default(imagePath).metadata();
  const width = Number(metadata.width);
  const height = Number(metadata.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    throw new Error(`Unable to read side image dimensions: ${path.basename(imagePath)}`);
  }
  return { width, height };
}

async function prepareOverlayAssets(
  config: BrandingConfig,
  videoInfo: VideoInfo,
): Promise<OverlayAssets> {
  let watermarkPath: string | null = null;
  let watermarkTargetWidthPx: number | null = null;
  let movingTextPath: string | null = null;
  const sideImages: OverlayAssets['sideImages'] = [];
  const sideImageDimensions: Partial<Record<BrandingSide, ImageDimensions>> = {};

  const sideImageConfigs = [
    { side: 'top' as const, config: config.canvas.top },
    { side: 'bottom' as const, config: config.canvas.bottom },
    { side: 'left' as const, config: config.canvas.left },
    { side: 'right' as const, config: config.canvas.right },
  ];
  for (const { side, config: sideConfig } of sideImageConfigs) {
    if (!sideConfig.enabled) {
      continue;
    }
    if (!sideConfig.imagePath) {
      throw new Error(`No image selected for the ${side} side`);
    }
    await fs.access(sideConfig.imagePath);
    const dimensions = await readImageDimensions(sideConfig.imagePath);
    sideImageDimensions[side] = dimensions;
    sideImages.push({ side, path: sideConfig.imagePath, dimensions });
  }

  const layout = resolveCanvasLayout(videoInfo, config.canvas, sideImageDimensions);

  if (config.watermark.enabled) {
    if (config.watermark.mode === 'image') {
      if (!config.watermark.imagePath) {
        throw new Error('No watermark logo selected');
      }
      await fs.access(config.watermark.imagePath);
      watermarkPath = config.watermark.imagePath;
      watermarkTargetWidthPx = Math.max(
        2,
        Math.round((layout.outputWidth * config.watermark.scalePercent) / 100),
      );
    } else {
      watermarkPath = await renderTextOverlayAsset({
        text: config.watermark.text.text,
        secondaryText: config.watermark.text.secondaryText,
        fontFamily: config.watermark.text.fontFamily,
        fontWeight: config.watermark.text.fontWeight,
        color: config.watermark.text.color,
        fontSizePx: Math.max(
          8,
          Math.round((layout.outputHeight * config.watermark.text.fontSizePercent) / 100),
        ),
        secondaryFontSizePx: Math.max(
          4,
          Math.round((layout.outputHeight * config.watermark.text.fontSizePercent * 0.38) / 100),
        ),
        maxWidthPx: Math.round(layout.outputWidth * 0.9),
        shadow: config.watermark.text.shadow,
      });
    }
  }

  if (config.movingText.enabled) {
    movingTextPath = await renderTextOverlayAsset({
      text: config.movingText.text,
      fontFamily: 'sans',
      fontWeight: 'medium',
      color: '#ffffff',
      fontSizePx: Math.max(
        8,
        Math.round((layout.outputHeight * config.movingText.sizePercent) / 100),
      ),
      maxWidthPx: Math.round(layout.outputWidth * 0.75),
      shadow: false,
    });
  }

  return { watermarkPath, watermarkTargetWidthPx, movingTextPath, sideImages, layout };
}

function isMp4LikeContainer(outputPath: string): boolean {
  const ext = path.extname(outputPath).toLowerCase();
  return ext === '.mp4' || ext === '.mov' || ext === '.m4v';
}

async function removeQuiet(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Apply every enabled branding overlay to one video using a single
 * filter_complex and a single encode pass.
 */
export async function brandVideo(options: BrandVideoOptions): Promise<BrandVideoResult> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available');
  }

  const { videoPath, outputPath, config, shouldCancel, registerChild, onPercent } = options;

  if (shouldCancel?.()) {
    throw new ProcessingCancelledError();
  }

  const videoInfo = await probeVideoInfo(videoPath, shouldCancel, registerChild);
  const assets = await prepareOverlayAssets(config, videoInfo);

  const inputPaths: string[] = [];
  const sideImagePlans: SideImageOverlayPlan[] = [];
  let watermarkInputIndex: number | null = null;
  let movingTextInputIndex: number | null = null;

  for (const sideImage of assets.sideImages) {
    inputPaths.push(sideImage.path);
    const inputIndex = inputPaths.length; // 0 is the source video
    const slot = assets.layout.slots.find((candidate) => candidate.side === sideImage.side);
    if (slot) {
      sideImagePlans.push({
        side: sideImage.side,
        inputIndex,
        width: slot.width,
        height: slot.height,
        x: slot.x,
        y: slot.y,
      });
    }
  }

  if (assets.watermarkPath) {
    inputPaths.push(assets.watermarkPath);
    watermarkInputIndex = inputPaths.length; // 0 is the source video
  }
  if (assets.movingTextPath) {
    inputPaths.push(assets.movingTextPath);
    movingTextInputIndex = inputPaths.length;
  }

  const speedPreset = MOVING_TEXT_SPEED_PRESETS[config.movingText.speed];
  const graph = buildBrandingFilterGraph({
    canvas: {
      outputWidth: assets.layout.outputWidth,
      outputHeight: assets.layout.outputHeight,
      videoX: assets.layout.videoX,
      videoY: assets.layout.videoY,
      videoWidth: assets.layout.videoWidth,
      videoHeight: assets.layout.videoHeight,
      zoomPercent: config.canvas.zoomPercent,
      backgroundColor: 'black',
    },
    sideImages: sideImagePlans,
    watermark:
      watermarkInputIndex !== null
        ? {
            inputIndex: watermarkInputIndex,
            targetWidthPx: assets.watermarkTargetWidthPx,
            opacity: config.watermark.opacityPercent / 100,
            position: config.watermark.position,
            marginPx: Math.round((assets.layout.outputWidth * config.watermark.marginPercent) / 100),
          }
        : null,
    movingText:
      movingTextInputIndex !== null
        ? {
            inputIndex: movingTextInputIndex,
            opacity: config.movingText.opacityPercent / 100,
            horizontalPeriodSeconds: speedPreset.horizontalPeriodSeconds,
            verticalPeriodSeconds: speedPreset.verticalPeriodSeconds,
          }
        : null,
  });

  if (!graph) {
    throw new Error('No branding overlay is enabled');
  }

  const previewDuration = options.previewDurationSeconds ?? null;
  const previewStart = options.previewStartSeconds ?? 0;
  const expectedDuration =
    previewDuration !== null
      ? Math.max(
          0.1,
          videoInfo.durationSeconds > 0
            ? Math.min(previewDuration, videoInfo.durationSeconds - previewStart)
            : previewDuration,
        )
      : videoInfo.durationSeconds;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const attempts = await buildEncoderAttempts();
  let lastError: unknown = null;

  for (const attempt of attempts) {
    if (shouldCancel?.()) {
      throw new ProcessingCancelledError();
    }

    const args: string[] = ['-hide_banner', '-loglevel', 'error', '-nostdin'];

    if (previewDuration !== null && previewStart > 0) {
      args.push('-ss', previewStart.toFixed(3));
    }
    args.push('-i', videoPath);

    for (const inputPath of inputPaths) {
      args.push('-loop', '1', '-i', inputPath);
    }

    if (previewDuration !== null) {
      args.push('-t', previewDuration.toFixed(3));
    }

    args.push(
      '-filter_complex',
      graph.filterComplex,
      '-map',
      `[${graph.outputLabel}]`,
      '-map',
      '0:a?',
      ...attempt.videoArgs,
      '-pix_fmt',
      'yuv420p',
      ...attempt.audioArgs,
      '-map_metadata',
      '0',
    );

    if (isMp4LikeContainer(outputPath)) {
      args.push('-movflags', '+faststart');
    }

    args.push('-progress', 'pipe:1', '-nostats', '-y', outputPath);

    try {
      await runFfmpegProcess(ffmpeg, args, {
        shouldCancel,
        registerChild,
        onProgressLine: (key, value) => {
          if (key !== 'out_time_ms' || !onPercent || expectedDuration <= 0) {
            return;
          }
          const microseconds = Number(value);
          if (!Number.isFinite(microseconds) || microseconds < 0) {
            return;
          }
          const seconds = microseconds / 1_000_000;
          onPercent(Math.max(0, Math.min(100, (seconds / expectedDuration) * 100)));
        },
      });

      onPercent?.(100);
      return {
        outputPath,
        encoder: attempt.label,
        videoInfo,
        outputWidth: assets.layout.outputWidth,
        outputHeight: assets.layout.outputHeight,
        outputAspectRatio: config.canvas.aspectRatio,
      };
    } catch (error) {
      await removeQuiet(outputPath);

      if (error instanceof ProcessingCancelledError) {
        throw error;
      }
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : 'encoding failed';
  throw new Error(reason);
}

/** Resolve a non-colliding `.mp4` output path so originals are never overwritten. */
export async function resolveBrandedOutputPath(
  outputDir: string,
  videoName: string,
): Promise<string> {
  const baseName = path.parse(videoName).name;
  let candidate = path.join(outputDir, `${baseName}.mp4`);
  let suffix = 1;

  for (;;) {
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
    suffix += 1;
    candidate = path.join(outputDir, `${baseName}_${String(suffix).padStart(2, '0')}.mp4`);
  }
}

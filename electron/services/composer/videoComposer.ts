import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ComposerClip, ComposerExportRequest } from '../../../shared/composer';
import { getFfmpegPath, toFfmpegPath } from '../ffmpegPaths';
import { ProcessingCancelledError } from '../frameGenerator';
import { probeMediaFile } from '../mediaProbe';
import { brandVideo } from '../branding/videoBrander';
import { hasAnyBrandingEnabled } from '../branding/brandingConfig';
import { runFfmpegProcess } from '../branding/ffmpegProcess';
import { buildColorGradeFilterChain } from '../videoColorGrade';
import {
  burnSubtitlesAss,
  generateEnglishSubtitlesAss,
} from '../subtitles/englishSubtitles';
import { runTaskPool } from '../taskPool';
import {
  FAST_EXPORT_CRF,
  FAST_EXPORT_FPS,
  FAST_EXPORT_PRESET,
  PREVIEW_CRF,
  PREVIEW_PRESET,
  SEGMENT_ENCODE_CONCURRENCY,
  capFastExportDimensions,
  capPreviewDimensions,
  THUMBNAIL_WIDTH,
} from './composerConfig';

export type ComposerEncodeProfile = 'preview' | 'export';

export interface ComposeVideoOptions extends Omit<ComposerExportRequest, 'audioPath'> {
  audioPath?: string | null;
  encodeProfile?: ComposerEncodeProfile;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
  onPercent?: (percent: number) => void;
  onPhase?: (message: string) => void;
  onEncoderAttempt?: (encoder: string, attempt: number, total: number) => void;
}

export interface ComposeVideoResult {
  outputPath: string;
  encoder: string;
  durationSeconds: number;
  outputWidth: number;
  outputHeight: number;
}

interface SourceMetadata {
  durationSeconds: number;
  hasAudio: boolean;
}

interface ExportSize {
  width: number;
  height: number;
}

const SEGMENT_PROGRESS_WEIGHT = 70;
const MUX_PROGRESS_WEIGHT = 29;

function buildVideoFilter(
  size: ExportSize,
  colorGradeFilter?: string | null,
): string {
  const base = `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${FAST_EXPORT_FPS},format=yuv420p`;
  if (colorGradeFilter && colorGradeFilter.trim().length > 0) {
    return `${base},${colorGradeFilter.trim()}`;
  }
  return base;
}

function resolveTransitionDuration(
  clipDurations: number[],
  requestedSeconds: number,
): number {
  if (clipDurations.length < 2 || requestedSeconds <= 0) {
    return 0;
  }

  const minClipDuration = Math.min(...clipDurations);
  const maxAllowed = Math.max(0.1, minClipDuration / 2 - 0.05);
  return Math.max(0.1, Math.min(requestedSeconds, maxAllowed));
}

function appendCrossfadeChains(
  chains: string[],
  segmentCount: number,
  clipDurations: number[],
  transitionSeconds: number,
): { videoLabel: string; audioLabel: string } {
  let videoOut = '0:v';
  let audioOut = '0:a';

  for (let index = 1; index < segmentCount; index += 1) {
    const offset =
      clipDurations.slice(0, index).reduce((sum, duration) => sum + duration, 0) -
      index * transitionSeconds;
    const videoNext = index === segmentCount - 1 ? 'vmerged' : `vx${index}`;
    const audioNext = index === segmentCount - 1 ? 'amerged' : `ax${index}`;

    chains.push(
      `[${videoOut}][${index}:v]xfade=transition=fade:duration=${transitionSeconds.toFixed(3)}:offset=${offset.toFixed(3)}[${videoNext}]`,
    );
    chains.push(
      `[${audioOut}][${index}:a]acrossfade=d=${transitionSeconds.toFixed(3)}:c1=tri:c2=tri[${audioNext}]`,
    );

    videoOut = videoNext;
    audioOut = audioNext;
  }

  return { videoLabel: 'vmerged', audioLabel: 'amerged' };
}

function mergedDurationWithTransitions(
  clipDurations: number[],
  transitionSeconds: number,
): number {
  const total = clipDurations.reduce((sum, duration) => sum + duration, 0);
  if (clipDurations.length < 2 || transitionSeconds <= 0) {
    return total;
  }
  return total - (clipDurations.length - 1) * transitionSeconds;
}

function segmentVideoArgs(profile: ComposerEncodeProfile = 'export'): string[] {
  const isPreview = profile === 'preview';
  return [
    '-c:v',
    'libx264',
    '-preset',
    isPreview ? PREVIEW_PRESET : FAST_EXPORT_PRESET,
    '-crf',
    String(isPreview ? PREVIEW_CRF : FAST_EXPORT_CRF),
    '-pix_fmt',
    'yuv420p',
  ];
}

function segmentAudioArgs(): string[] {
  return ['-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2'];
}

function escapeConcatPath(filePath: string): string {
  return toFfmpegPath(path.resolve(filePath)).replace(/'/g, "'\\''");
}

async function resolveSourceMetadata(
  clips: ComposerClip[],
  sourceProbes: ComposerExportRequest['sourceProbes'],
  shouldCancel?: () => boolean,
  registerChild?: (child: ChildProcess | null) => void,
): Promise<Map<string, SourceMetadata>> {
  const uniqueSources = [
    ...new Set(clips.filter((clip) => !clip.isPadImage).map((clip) => clip.sourcePath)),
  ];
  const metadata = new Map<string, SourceMetadata>();

  for (const sourcePath of uniqueSources) {
    const cached = sourceProbes?.[sourcePath];
    if (cached && cached.durationSeconds > 0) {
      metadata.set(sourcePath, {
        durationSeconds: cached.durationSeconds,
        hasAudio: cached.hasAudio,
      });
      continue;
    }

    const info = await probeMediaFile(sourcePath, shouldCancel, registerChild);
    metadata.set(sourcePath, {
      durationSeconds: info.durationSeconds,
      hasAudio: info.hasAudio,
    });
  }

  for (const clip of clips) {
    if (clip.isPadImage && !metadata.has(clip.sourcePath)) {
      metadata.set(clip.sourcePath, {
        durationSeconds: clip.durationSeconds,
        hasAudio: false,
      });
    }
  }

  return metadata;
}

async function encodeClipSegment(options: {
  ffmpeg: string;
  clip: ComposerClip;
  metadata: SourceMetadata;
  exportSize: ExportSize;
  outputPath: string;
  encodeProfile: ComposerEncodeProfile;
  colorGradeFilter?: string | null;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
}): Promise<void> {
  const {
    ffmpeg,
    clip,
    metadata,
    exportSize,
    outputPath,
    encodeProfile,
    colorGradeFilter,
    shouldCancel,
    registerChild,
  } = options;
  const vf = buildVideoFilter(exportSize, colorGradeFilter);
  const duration = Math.max(0.1, clip.durationSeconds);

  if (clip.isPadImage) {
    await runFfmpegProcess(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-loop',
        '1',
        '-t',
        duration.toFixed(3),
        '-i',
        toFfmpegPath(clip.sourcePath),
        '-f',
        'lavfi',
        '-t',
        duration.toFixed(3),
        '-i',
        'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-vf',
        vf,
        '-map',
        '0:v',
        '-map',
        '1:a',
        ...segmentVideoArgs(encodeProfile),
        ...segmentAudioArgs(),
        '-shortest',
        '-y',
        toFfmpegPath(outputPath),
      ],
      { shouldCancel, registerChild },
    );
    return;
  }

  const seekStart = Math.max(0, clip.startSeconds);
  const useSourceAudio = metadata.hasAudio && !clip.muted;
  const volume = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volumePercent / 100));

  if (useSourceAudio) {
    await runFfmpegProcess(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-ss',
        seekStart.toFixed(3),
        '-t',
        duration.toFixed(3),
        '-i',
        toFfmpegPath(clip.sourcePath),
        '-vf',
        vf,
        '-af',
        `volume=${volume.toFixed(3)}`,
        ...segmentVideoArgs(encodeProfile),
        ...segmentAudioArgs(),
        '-shortest',
        '-y',
        toFfmpegPath(outputPath),
      ],
      { shouldCancel, registerChild },
    );
    return;
  }

  await runFfmpegProcess(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-ss',
      seekStart.toFixed(3),
      '-t',
      duration.toFixed(3),
      '-i',
      toFfmpegPath(clip.sourcePath),
      '-f',
      'lavfi',
      '-t',
      duration.toFixed(3),
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-vf',
      vf,
      '-map',
      '0:v',
      '-map',
      '1:a',
      ...segmentVideoArgs(encodeProfile),
      ...segmentAudioArgs(),
      '-shortest',
      '-y',
      toFfmpegPath(outputPath),
    ],
    { shouldCancel, registerChild },
  );
}

async function muxFinalOutput(options: {
  ffmpeg: string;
  segmentPaths: string[];
  concatListPath: string;
  clipDurations: number[];
  transitionDurationSeconds: number;
  audioPath?: string | null;
  audioDelaySeconds: number;
  exportSize: ExportSize;
  outputPath: string;
  expectedDuration: number;
  encodeProfile?: ComposerEncodeProfile;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
  onPercent?: (percent: number) => void;
}): Promise<void> {
  const {
    ffmpeg,
    segmentPaths,
    concatListPath,
    clipDurations,
    transitionDurationSeconds,
    audioPath,
    audioDelaySeconds,
    outputPath,
    expectedDuration,
    encodeProfile = 'export',
    shouldCancel,
    registerChild,
    onPercent,
  } = options;

  const hasExternalAudio = Boolean(audioPath && audioPath.trim().length > 0);

  const transitionSeconds = resolveTransitionDuration(clipDurations, transitionDurationSeconds);
  const useCrossfade = segmentPaths.length > 1 && transitionSeconds > 0;
  const delayMs = Math.round(audioDelaySeconds * 1000);
  const chains: string[] = [];
  const baseArgs: string[] = ['-hide_banner', '-loglevel', 'error', '-nostdin'];

  let mergedVideoLabel = '0:v';
  let clipAudioLabel = '0:a';
  let externalAudioIndex = 1;

  if (useCrossfade) {
    for (const segmentPath of segmentPaths) {
      baseArgs.push('-i', toFfmpegPath(segmentPath));
    }
    if (hasExternalAudio && audioPath) {
      baseArgs.push('-i', toFfmpegPath(audioPath));
      externalAudioIndex = segmentPaths.length;
    }

    const merged = appendCrossfadeChains(
      chains,
      segmentPaths.length,
      clipDurations,
      transitionSeconds,
    );
    mergedVideoLabel = merged.videoLabel;
    clipAudioLabel = merged.audioLabel;
  } else {
    baseArgs.push('-f', 'concat', '-safe', '0', '-i', toFfmpegPath(concatListPath));
    if (hasExternalAudio && audioPath) {
      baseArgs.push('-i', toFfmpegPath(audioPath));
      externalAudioIndex = 1;
    }
  }

  let audioMapLabel = clipAudioLabel;
  if (hasExternalAudio) {
    chains.push(`[${externalAudioIndex}:a]adelay=${delayMs}|${delayMs}[exta]`);
    chains.push(
      `[${clipAudioLabel}][exta]amix=inputs=2:duration=longest:dropout_transition=2[aout]`,
    );
    audioMapLabel = 'aout';
  }

  const usesFilterGraph = chains.length > 0;
  const videoFiltered = useCrossfade;
  const videoMap = videoFiltered ? `[${mergedVideoLabel}]` : '0:v';
  const audioMap = usesFilterGraph ? `[${audioMapLabel}]` : '0:a';
  const needsVideoEncode = useCrossfade;
  const isPreview = encodeProfile === 'preview';
  const outputArgs = [
    ...(usesFilterGraph ? ['-filter_complex', chains.join(';')] : []),
    '-map',
    videoMap,
    '-map',
    audioMap,
    ...(needsVideoEncode ? segmentVideoArgs(encodeProfile) : ['-c:v', 'copy']),
    '-c:a',
    'aac',
    '-b:a',
    isPreview ? '96k' : '192k',
    '-movflags',
    '+faststart',
    ...(expectedDuration > 0 ? ['-t', expectedDuration.toFixed(3)] : []),
    '-progress',
    'pipe:1',
    '-nostats',
    '-y',
    toFfmpegPath(outputPath),
  ];

  await runFfmpegProcess(ffmpeg, [...baseArgs, ...outputArgs], {
    shouldCancel,
    registerChild,
    onProgressLine: (key, value) => {
      if (!onPercent || expectedDuration <= 0 || key !== 'out_time_ms') {
        return;
      }
      const microseconds = Number(value);
      if (!Number.isFinite(microseconds) || microseconds < 0) {
        return;
      }
      const muxPercent = (microseconds / 1_000_000 / expectedDuration) * MUX_PROGRESS_WEIGHT;
      onPercent(SEGMENT_PROGRESS_WEIGHT + Math.min(MUX_PROGRESS_WEIGHT - 1, muxPercent));
    },
  });
}

export async function composeVideo(options: ComposeVideoOptions): Promise<ComposeVideoResult> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available');
  }

  const {
    clips,
    audioPath,
    audioDelaySeconds,
    audioDurationSeconds,
    sourceProbes,
    branding,
    transitionDurationSeconds,
    outputPath,
    outputWidth,
    outputHeight,
    encodeProfile = 'export',
    shouldCancel,
    registerChild,
    onPercent,
    onPhase,
    onEncoderAttempt,
  } = options;

  if (clips.length === 0) {
    throw new Error('No clips to compose');
  }

  onEncoderAttempt?.('libx264', 1, 1);

  const exportSize =
    encodeProfile === 'preview'
      ? capPreviewDimensions(outputWidth, outputHeight)
      : capFastExportDimensions(outputWidth, outputHeight);
  const sourceMetadata = await resolveSourceMetadata(
    clips,
    sourceProbes,
    shouldCancel,
    registerChild,
  );

  const clipDurations = clips.map((clip) => clip.durationSeconds);
  const transitionSeconds = resolveTransitionDuration(clipDurations, transitionDurationSeconds);
  const videoDuration = mergedDurationWithTransitions(clipDurations, transitionSeconds);
  const hasExternalAudio = Boolean(audioPath && audioPath.trim().length > 0);
  const audioTimelineDuration =
    hasExternalAudio && (audioDurationSeconds ?? 0) > 0
      ? audioDurationSeconds! + audioDelaySeconds
      : 0;
  const expectedDuration = Math.max(videoDuration, audioTimelineDuration);
  const colorGradeFilter =
    branding.imagePreset?.enabled
      ? buildColorGradeFilterChain({
          filter: branding.imagePreset.filter,
          tuning: branding.imagePreset.tuning,
        })
      : null;
  const brandingForPass = {
    ...branding,
    imagePreset: {
      ...branding.imagePreset,
      enabled: false,
    },
    subtitles: {
      ...branding.subtitles,
      enabled: false,
    },
  };
  const applyBrandingPass = hasAnyBrandingEnabled(brandingForPass);
  const applySubtitles = Boolean(branding.subtitles?.enabled);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfg-composer-'));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const needsPostPass = applyBrandingPass || applySubtitles;
  const muxOutputPath = needsPostPass ? path.join(tempDir, 'muxed.mp4') : outputPath;

  try {
    onPhase?.('Encoding clip segments');
    onPercent?.(1);

    const segmentPaths = await runTaskPool(
      clips.length,
      SEGMENT_ENCODE_CONCURRENCY,
      async (index) => {
        if (shouldCancel?.()) {
          throw new ProcessingCancelledError();
        }

        const clip = clips[index];
        const metadata = sourceMetadata.get(clip.sourcePath);
        if (!metadata) {
          throw new Error(`Missing metadata for ${clip.sourceName}`);
        }

        const segmentPath = path.join(tempDir, `seg-${String(index).padStart(3, '0')}.mp4`);
        onPhase?.(`Encoding clip ${index + 1}/${clips.length}: ${clip.sourceName}`);

        await encodeClipSegment({
          ffmpeg,
          clip,
          metadata,
          exportSize,
          outputPath: segmentPath,
          encodeProfile,
          colorGradeFilter,
          shouldCancel,
          registerChild,
        });

        const segmentPercent = ((index + 1) / clips.length) * SEGMENT_PROGRESS_WEIGHT;
        onPercent?.(Math.max(1, Math.min(SEGMENT_PROGRESS_WEIGHT, segmentPercent)));
        return segmentPath;
      },
    );

    const concatListPath = path.join(tempDir, 'concat.txt');
    const concatContent = segmentPaths.map((segment) => `file '${escapeConcatPath(segment)}'`).join('\n');
    await fs.writeFile(concatListPath, concatContent, 'utf8');

    onPhase?.('Muxing final output');
    onPercent?.(SEGMENT_PROGRESS_WEIGHT + 1);

    await muxFinalOutput({
      ffmpeg,
      segmentPaths,
      concatListPath,
      clipDurations,
      transitionDurationSeconds,
      audioPath: hasExternalAudio ? audioPath : null,
      audioDelaySeconds,
      exportSize,
      outputPath: muxOutputPath,
      expectedDuration,
      encodeProfile,
      shouldCancel,
      registerChild,
      onPercent: needsPostPass
        ? (percent) => {
            onPercent?.(percent * (applyBrandingPass ? 0.75 : 0.85));
          }
        : onPercent,
    });

    let finalOutputPath = muxOutputPath;
    let encoderLabel =
      encodeProfile === 'preview'
        ? `libx264 (${PREVIEW_PRESET} · 50% preview)`
        : `libx264 (${FAST_EXPORT_PRESET} · 1080p · fade)`;

    let workingPath = muxOutputPath;

    if (applyBrandingPass) {
      onPhase?.('Applying branding overlays');
      onPercent?.(applySubtitles ? 75 : 85);
      const brandedPath = applySubtitles ? path.join(tempDir, 'branded.mp4') : outputPath;
      const brandResult = await brandVideo({
        videoPath: muxOutputPath,
        outputPath: brandedPath,
        config: brandingForPass,
        encodeProfile,
        shouldCancel,
        registerChild,
        onPercent: (percent) => {
          const base = applySubtitles ? 75 : 85;
          const span = applySubtitles ? 10 : 15;
          onPercent?.(base + percent * (span / 100));
        },
      });
      workingPath = brandResult.outputPath;
      finalOutputPath = brandResult.outputPath;
      encoderLabel = `${encoderLabel} + ${brandResult.encoder}`;
    }

    if (applySubtitles && encodeProfile === 'export') {
      onPhase?.('Generating English subtitles');
      // Prefer clean soundtrack ASR + exact adelay offset. Muxed mix includes clip
      // audio that confuses Whisper late in the timeline (start OK, end drifts).
      const useSoundtrackAsr = hasExternalAudio && Boolean(audioPath);
      const assPath = await generateEnglishSubtitlesAss({
        mediaPath: useSoundtrackAsr ? (audioPath as string) : workingPath,
        timelineOffsetSeconds: useSoundtrackAsr ? audioDelaySeconds : 0,
        clampToMediaPath: workingPath,
        onStatus: (message) => onPhase?.(message),
        shouldCancel,
        registerChild,
        position: branding.subtitles,
      });
      if (assPath) {
        onPhase?.('Burning subtitles');
        onPercent?.(90);
        await burnSubtitlesAss({
          videoPath: workingPath,
          assPath,
          outputPath,
          shouldCancel,
          registerChild,
          onPercent: (percent) => {
            onPercent?.(90 + percent * 0.1);
          },
        });
        await fs.unlink(assPath).catch(() => {});
        finalOutputPath = outputPath;
        encoderLabel = `${encoderLabel} + subtitles`;
      } else if (workingPath !== outputPath) {
        await fs.copyFile(workingPath, outputPath);
        finalOutputPath = outputPath;
      }
    } else if (workingPath !== outputPath) {
      await fs.copyFile(workingPath, outputPath);
      finalOutputPath = outputPath;
    }

    onPercent?.(100);
    const profileLabel = encoderLabel;
    return {
      outputPath: finalOutputPath,
      encoder: profileLabel,
      durationSeconds: expectedDuration,
      outputWidth: exportSize.width,
      outputHeight: exportSize.height,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function generateVideoThumbnails(
  videoPath: string,
  outputDir: string,
  shouldCancel?: () => boolean,
  registerChild?: (child: ChildProcess | null) => void,
): Promise<string[]> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available');
  }

  await fs.mkdir(outputDir, { recursive: true });
  const thumbPath = path.normalize(path.join(outputDir, 'thumb-001.jpg'));
  const seekSeconds = 1;
  await runFfmpegProcess(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      String(seekSeconds),
      '-i',
      toFfmpegPath(videoPath),
      '-frames:v',
      '1',
      '-vf',
      `scale=${THUMBNAIL_WIDTH}:-2`,
      '-y',
      toFfmpegPath(thumbPath),
    ],
    { shouldCancel, registerChild },
  );

  try {
    await fs.access(thumbPath);
    return [thumbPath];
  } catch {
    return [];
  }
}

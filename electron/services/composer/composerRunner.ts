import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  COMPOSER_TRANSITION_SECONDS,
  createDefaultComposerBranding,
  INITIAL_COMPOSER_PROGRESS,
  type ComposerEvent,
  type ComposerEventType,
  type ComposerExportRequest,
  type ComposerPlanTimelineRequest,
  type ComposerPlanTimelineResult,
  type ComposerPreviewRequest,
  type ComposerPreviewResult,
  type ComposerProgress,
} from '../../../shared/composer';
import type { BrandingConfig } from '../../../shared/branding';
import type { LogEntry } from '../../../shared/ipc';
import { assertFfmpegAvailable } from '../ffmpegPaths';
import { ProcessingCancelledError } from '../frameGenerator';
import {
  hasAnyBrandingEnabled,
  sanitizeBrandingConfig,
  validateBrandingConfig,
} from '../branding/brandingConfig';
import { buildComposerTimeline } from './clipPlanner';
import { composeVideo, generateVideoThumbnails } from './videoComposer';
import { generatePreviewProxy } from './previewProxy';
import { COMPOSER_PIPELINE_STEPS, COMPOSER_STEP_TOTAL, IMPORT_CONCURRENCY } from './composerConfig';
import { runTaskPool } from '../taskPool';

type ProgressListener = (event: ComposerEvent) => void;

const MAX_LOG_ENTRIES = 50;

function sanitizeBranding(value: unknown): BrandingConfig {
  if (typeof value === 'object' && value !== null) {
    return sanitizeBrandingConfig(value);
  }
  return createDefaultComposerBranding();
}

function sanitizeExportRequest(value: unknown): ComposerExportRequest {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid export request');
  }
  const request = value as Partial<ComposerExportRequest>;
  if (!Array.isArray(request.clips) || request.clips.length === 0) {
    throw new Error('Add at least one clip');
  }
  if (typeof request.audioPath !== 'string' || request.audioPath.trim().length === 0) {
    throw new Error('Select an audio file');
  }
  if (typeof request.outputPath !== 'string' || request.outputPath.trim().length === 0) {
    throw new Error('Invalid output path');
  }
  if (
    typeof request.outputWidth !== 'number' ||
    typeof request.outputHeight !== 'number' ||
    request.outputWidth < 2 ||
    request.outputHeight < 2
  ) {
    throw new Error('Invalid output dimensions');
  }

  return {
    clips: request.clips,
    audioPath: request.audioPath,
    audioDelaySeconds:
      typeof request.audioDelaySeconds === 'number' ? request.audioDelaySeconds : 1,
    audioDurationSeconds:
      typeof request.audioDurationSeconds === 'number' && request.audioDurationSeconds > 0
        ? request.audioDurationSeconds
        : undefined,
    sourceProbes:
      request.sourceProbes && typeof request.sourceProbes === 'object'
        ? request.sourceProbes
        : undefined,
    branding: sanitizeBranding(request.branding),
    transitionDurationSeconds:
      typeof request.transitionDurationSeconds === 'number'
        ? request.transitionDurationSeconds
        : 0.5,
    outputPath: request.outputPath,
    outputWidth: request.outputWidth,
    outputHeight: request.outputHeight,
  };
}

function sanitizePreviewRequest(value: unknown): ComposerPreviewRequest {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid preview request');
  }
  const request = value as Partial<ComposerPreviewRequest>;
  if (!Array.isArray(request.clips) || request.clips.length === 0) {
    throw new Error('Add at least one clip');
  }
  if (
    typeof request.outputWidth !== 'number' ||
    typeof request.outputHeight !== 'number' ||
    request.outputWidth < 2 ||
    request.outputHeight < 2
  ) {
    throw new Error('Invalid output dimensions');
  }

  return {
    clips: request.clips,
    audioPath:
      typeof request.audioPath === 'string' && request.audioPath.trim().length > 0
        ? request.audioPath
        : null,
    audioDelaySeconds:
      typeof request.audioDelaySeconds === 'number' ? request.audioDelaySeconds : 1,
    audioDurationSeconds:
      typeof request.audioDurationSeconds === 'number' && request.audioDurationSeconds > 0
        ? request.audioDurationSeconds
        : undefined,
    sourceProbes:
      request.sourceProbes && typeof request.sourceProbes === 'object'
        ? request.sourceProbes
        : undefined,
    branding: sanitizeBranding(request.branding),
    transitionDurationSeconds:
      typeof request.transitionDurationSeconds === 'number'
        ? request.transitionDurationSeconds
        : COMPOSER_TRANSITION_SECONDS,
    outputWidth: request.outputWidth,
    outputHeight: request.outputHeight,
  };
}

function sanitizePlanRequest(value: unknown): ComposerPlanTimelineRequest {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid timeline plan request');
  }
  const request = value as Partial<ComposerPlanTimelineRequest>;
  if (!Array.isArray(request.videos) || request.videos.length === 0) {
    throw new Error('Add at least one video');
  }
  if (typeof request.audioDurationSeconds !== 'number' || request.audioDurationSeconds <= 0) {
    throw new Error('Audio duration must be greater than zero');
  }
  if (!Array.isArray(request.clips)) {
    throw new Error('Invalid clips');
  }
  return {
    videos: request.videos,
    audioDurationSeconds: request.audioDurationSeconds,
    clips: request.clips,
  };
}

export class ComposerRunner {
  private cancelled = false;
  private running = false;
  private previewCancelled = false;
  private previewRunning = false;
  private currentChild: ChildProcess | null = null;
  private previewChild: ChildProcess | null = null;
  private listeners = new Set<ProgressListener>();
  private progress: ComposerProgress = { ...INITIAL_COMPOSER_PROGRESS, logs: [] };
  private startedAt = 0;
  private mediaRoot: string | null = null;
  private previewOutputPath: string | null = null;
  private isOtherJobRunning: () => boolean;

  constructor(isOtherJobRunning: () => boolean) {
    this.isOtherJobRunning = isOtherJobRunning;
  }

  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  getProgress(): ComposerProgress {
    return { ...this.progress, logs: [...this.progress.logs] };
  }

  cancel(): void {
    if (this.previewRunning) {
      this.previewCancelled = true;
      if (this.previewChild && !this.previewChild.killed) {
        this.previewChild.kill('SIGTERM');
      }
    }
    if (!this.running) {
      return;
    }
    this.cancelled = true;
    if (this.currentChild && !this.currentChild.killed) {
      this.currentChild.kill('SIGTERM');
    }
  }

  cancelPreview(): void {
    if (!this.previewRunning) {
      return;
    }
    this.previewCancelled = true;
    if (this.previewChild && !this.previewChild.killed) {
      this.previewChild.kill('SIGTERM');
    }
  }

  async generatePreview(request: unknown): Promise<ComposerPreviewResult> {
    const ffmpegStatus = assertFfmpegAvailable();
    if (!ffmpegStatus.available) {
      throw new Error(ffmpegStatus.error ?? 'FFmpeg is required');
    }

    if (this.running) {
      throw new Error('Video combiner export is running');
    }

    if (this.previewRunning) {
      this.cancelPreview();
    }

    const previewRequest = sanitizePreviewRequest(request);
    this.previewRunning = true;
    this.previewCancelled = false;

    if (!this.mediaRoot) {
      this.mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vfg-composer-media-'));
    }

    const outputPath = path.join(this.mediaRoot, `preview-${Date.now()}.mp4`);
    const previousPreview = this.previewOutputPath;

    try {
      const result = await composeVideo({
        clips: previewRequest.clips,
        audioPath: previewRequest.audioPath,
        audioDelaySeconds: previewRequest.audioDelaySeconds,
        audioDurationSeconds: previewRequest.audioDurationSeconds,
        sourceProbes: previewRequest.sourceProbes,
        branding: previewRequest.branding,
        transitionDurationSeconds: previewRequest.transitionDurationSeconds,
        outputPath,
        outputWidth: previewRequest.outputWidth,
        outputHeight: previewRequest.outputHeight,
        encodeProfile: 'preview',
        shouldCancel: () => this.previewCancelled,
        registerChild: (child) => {
          this.previewChild = child;
        },
      });

      if (this.previewCancelled) {
        throw new ProcessingCancelledError();
      }

      this.previewOutputPath = result.outputPath;
      if (previousPreview && previousPreview !== result.outputPath) {
        await fs.rm(previousPreview, { force: true }).catch(() => {});
      }

      return {
        outputPath: result.outputPath,
        durationSeconds: result.durationSeconds,
      };
    } finally {
      this.previewChild = null;
      this.previewRunning = false;
      this.previewCancelled = false;
    }
  }

  async generateThumbnails(videoPaths: string[]): Promise<Record<string, string[]>> {
    return this.importMedia(videoPaths).then((result) => result.thumbnails);
  }

  async generateProxies(videoPaths: string[]): Promise<Record<string, string>> {
    return this.importMedia(videoPaths).then((result) => result.proxies);
  }

  async importMedia(
    videoPaths: string[],
  ): Promise<{ thumbnails: Record<string, string[]>; proxies: Record<string, string> }> {
    const ffmpegStatus = assertFfmpegAvailable();
    if (!ffmpegStatus.available) {
      throw new Error(ffmpegStatus.error ?? 'FFmpeg is required');
    }

    if (this.running) {
      throw new Error('Video combiner is already running');
    }

    this.running = true;
    this.cancelled = false;
    this.startedAt = Date.now();

    if (!this.mediaRoot) {
      this.mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vfg-composer-media-'));
    }

    const thumbnails: Record<string, string[]> = {};
    const proxies: Record<string, string> = {};
    const total = videoPaths.length;

    this.setStep(2, `Generating thumbnails & proxy (0/${total})`, {
      status: 'importing',
      progressPercent: 0,
      logs: this.pushLog('info', `[Combiner] Importing ${total} video(s)`),
    });

    try {
      await runTaskPool(videoPaths.length, IMPORT_CONCURRENCY, async (index) => {
        if (this.cancelled) {
          return;
        }

        const videoPath = videoPaths[index];
        const normalizedPath = path.normalize(videoPath);
        const videoName = path.basename(videoPath);
        const baseName = path.basename(videoPath, path.extname(videoPath));
        const thumbDir = path.join(this.mediaRoot!, `${baseName}-thumbs`);
        const proxyPath = path.join(this.mediaRoot!, `${baseName}-proxy.mp4`);

        this.setStep(2, `Import ${index + 1}/${total}: ${videoName}`, {
          currentFile: videoName,
          progressPercent: total > 0 ? Number((((index + 0.5) / total) * 100).toFixed(1)) : 0,
        });

        const [thumbList, proxy] = await Promise.all([
          generateVideoThumbnails(
            videoPath,
            thumbDir,
            () => this.cancelled,
            (child) => {
              this.currentChild = child;
            },
          ),
          generatePreviewProxy(
            videoPath,
            proxyPath,
            () => this.cancelled,
            (child) => {
              this.currentChild = child;
            },
          ),
        ]);

        thumbnails[normalizedPath] = thumbList;
        proxies[normalizedPath] = proxy;
      });

      this.setStep(2, `Media ready (${total} video${total === 1 ? '' : 's'})`, {
        status: 'ready',
        progressPercent: 100,
        currentFile: null,
        logs: this.pushLog('success', `[Combiner] Thumbnails & proxies ready — ${total} video(s)`),
      });

      return { thumbnails, proxies };
    } finally {
      this.currentChild = null;
      this.running = false;
    }
  }

  async planTimeline(request: unknown): Promise<ComposerPlanTimelineResult> {
    const ffmpegStatus = assertFfmpegAvailable();
    if (!ffmpegStatus.available) {
      throw new Error(ffmpegStatus.error ?? 'FFmpeg is required');
    }

    if (this.running) {
      throw new Error('Video combiner is already running');
    }

    this.running = true;
    this.cancelled = false;
    this.startedAt = Date.now();
    const planRequest = sanitizePlanRequest(request);

    this.setStep(4, 'Planning timeline', {
      status: 'analyzing',
      progressPercent: 5,
      logs: this.pushLog('info', '[Combiner] Planning timeline'),
    });

    try {
      const planned = await buildComposerTimeline({
        videos: planRequest.videos.map((video) => ({
          path: video.path,
          name: video.name,
          durationSeconds: video.durationSeconds,
        })),
        audioDurationSeconds: planRequest.audioDurationSeconds,
        userClips: planRequest.clips,
        onProgress: (message) => {
          this.setStep(4, message, {
            progressPercent: 50,
            currentFile: message,
          });
        },
      });

      this.setStep(4, `Timeline ready (${planned.clips.length} clips)`, {
        status: 'ready',
        progressPercent: 100,
        targetDurationSeconds: planned.targetDurationSeconds,
        currentFile: null,
        logs: this.pushLog(
          'success',
          `[Combiner] Timeline planned — ${planned.clips.length} clips, ${planned.targetDurationSeconds.toFixed(1)}s`,
        ),
      });

      return planned;
    } finally {
      this.currentChild = null;
      this.running = false;
    }
  }

  async startExport(request: unknown): Promise<void> {
    if (this.running || this.isOtherJobRunning()) {
      return;
    }

    this.running = true;
    this.cancelled = false;
    this.startedAt = Date.now();

    try {
      const exportRequest = sanitizeExportRequest(request);

      if (hasAnyBrandingEnabled(exportRequest.branding)) {
        const validationError = validateBrandingConfig(exportRequest.branding);
        if (validationError) {
          throw new Error(validationError);
        }
      }

      this.setStep(5, 'Preparing encode', {
        status: 'exporting',
        progressPercent: 0,
        logs: this.pushLog('info', '[Combiner] Starting export'),
      });
      this.emit('composer-started');

      const ffmpegStatus = assertFfmpegAvailable();
      if (!ffmpegStatus.available) {
        throw new Error(ffmpegStatus.error ?? 'FFmpeg is required');
      }

      this.setStep(5, 'Encoding video (1080p HD)', {
        progressPercent: 0,
      });

      const result = await composeVideo({
        ...exportRequest,
        shouldCancel: () => this.cancelled,
        registerChild: (child) => {
          this.currentChild = child;
        },
        onPercent: (percent) => {
          const rounded = Math.round(percent);
          let stepLabel: string;
          if (rounded >= 99) {
            stepLabel = 'Finalizing encode…';
          } else if (rounded >= 85) {
            stepLabel = `Applying branding: ${rounded}%`;
          } else if (rounded < 70) {
            stepLabel = `Encoding clips: ${rounded}%`;
          } else {
            stepLabel = `Muxing output: ${rounded}%`;
          }
          this.setStep(5, stepLabel, {
            progressPercent: percent,
          });
        },
        onPhase: (message) => {
          this.setStep(5, message, {
            logs: this.pushLog('info', `[Combiner] ${message}`),
          });
        },
        onEncoderAttempt: (encoder) => {
          this.setStep(5, `Encoding with ${encoder}`, {
            logs: this.pushLog('info', `[Combiner] Encoding with ${encoder}`),
          });
        },
      });

      if (this.cancelled) {
        this.finishCancelled();
        return;
      }

      this.setStep(6, `Export complete — ${path.basename(result.outputPath)}`, {
        status: 'completed',
        progressPercent: 100,
        encoder: result.encoder,
        outputPath: result.outputPath,
        currentFile: result.outputPath,
        logs: this.pushLog('success', `[Combiner] Export complete (${result.encoder})`),
      });
      this.emit('composer-completed');
    } catch (error) {
      if (error instanceof ProcessingCancelledError || this.cancelled) {
        this.finishCancelled();
        return;
      }
      const reason = error instanceof Error ? error.message : 'Unknown composer error';
      this.progress = {
        ...this.progress,
        status: 'error',
        message: reason,
        elapsedMs: Date.now() - this.startedAt,
        logs: this.pushLog('error', `[Combiner] Failed: ${reason}`),
      };
      this.emit('composer-failed');
    } finally {
      this.currentChild = null;
      this.running = false;
    }
  }

  async dispose(): Promise<void> {
    this.cancelPreview();
    if (!this.mediaRoot) {
      return;
    }
    try {
      await fs.rm(this.mediaRoot, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    this.mediaRoot = null;
    this.previewOutputPath = null;
  }

  private finishCancelled(): void {
    this.progress = {
      ...this.progress,
      status: 'cancelled',
      message: 'Export cancelled',
      elapsedMs: Date.now() - this.startedAt,
      logs: this.pushLog('info', '[Combiner] Cancelled by user'),
    };
    this.emit('composer-cancelled');
  }

  private setStep(
    stepIndex: number,
    message: string,
    patch: Partial<ComposerProgress> = {},
  ): void {
    const stepLabel = COMPOSER_PIPELINE_STEPS[stepIndex - 1] ?? null;
    const nextStepLabel =
      stepIndex < COMPOSER_STEP_TOTAL ? (COMPOSER_PIPELINE_STEPS[stepIndex] ?? null) : null;

    this.progress = {
      ...this.progress,
      stepIndex,
      stepTotal: COMPOSER_STEP_TOTAL,
      stepLabel,
      nextStepLabel,
      currentStep: stepLabel,
      message,
      elapsedMs: Date.now() - this.startedAt,
      ...patch,
    };
    this.emit('composer-progress');
  }

  private pushLog(level: LogEntry['level'], message: string): LogEntry[] {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      message,
    };
    const next = [...this.progress.logs, entry];
    return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
  }

  private emit(type: ComposerEventType): void {
    const event: ComposerEvent = { type, progress: this.getProgress() };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

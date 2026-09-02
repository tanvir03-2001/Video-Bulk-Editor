import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  BRANDING_REPORT_FILE,
  INITIAL_BRANDING_PROGRESS,
  type BrandingBatchRequest,
  type BrandingEvent,
  type BrandingEventType,
  type BrandingPreviewRequest,
  type BrandingProgress,
  type BrandingReport,
  type BrandingReportEntry,
} from '../../../shared/branding';
import type { LogEntry } from '../../../shared/ipc';
import { assertFfmpegAvailable } from '../ffmpegPaths';
import { ProcessingCancelledError } from '../frameGenerator';
import {
  PREVIEW_DURATION_SECONDS,
  PREVIEW_MAX_START_SECONDS,
  PREVIEW_START_FRACTION,
  hasAnyBrandingEnabled,
  validateBrandingConfig,
} from './brandingConfig';
import { disposeOverlayAssets, getTextRendererName } from './overlayAssets';
import {
  brandVideo,
  probeVideoInfo,
  resolveBrandedOutputPath,
} from './videoBrander';
import { createProgressThrottle } from '../progressThrottle';
import { cancelWhisperTranscription } from '../subtitles/whisperAsrClient';

type ProgressListener = (event: BrandingEvent) => void;

const MAX_LOG_ENTRIES = 50;

function formatPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Number(((completed / total) * 100).toFixed(2));
}

export class BrandingRunner {
  private cancelled = false;
  private running = false;
  private currentChild: ChildProcess | null = null;
  private listeners = new Set<ProgressListener>();
  private progress: BrandingProgress = { ...INITIAL_BRANDING_PROGRESS, logs: [], failedFiles: [] };
  private startedAt = 0;
  private previewDir: string | null = null;
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

  getProgress(): BrandingProgress {
    return this.cloneProgress();
  }

  cancel(): void {
    if (!this.running) {
      return;
    }
    this.cancelled = true;
    cancelWhisperTranscription();
    if (this.currentChild && !this.currentChild.killed) {
      this.currentChild.kill('SIGTERM');
    }
  }

  async startPreview(request: BrandingPreviewRequest): Promise<void> {
    if (!this.beginJob('preview')) {
      return;
    }

    const { videoPath, config } = request;

    this.progress = {
      ...this.progress,
      status: 'previewing',
      currentFile: path.basename(videoPath),
      totalVideos: 1,
      currentStep: 'Reading video',
      message: 'Generating preview',
      logs: this.pushLog('info', `[Branding] Generating preview for ${path.basename(videoPath)}`),
    };
    this.emit('branding-started');

    try {
      this.assertReady(config);

      const previewDir = await this.ensurePreviewDir();
      await this.clearPreviewDir(previewDir);

      const info = await probeVideoInfo(
        videoPath,
        () => this.cancelled,
        (child) => {
          this.currentChild = child;
        },
      );

      const start =
        info.durationSeconds > PREVIEW_DURATION_SECONDS * 2
          ? Math.min(info.durationSeconds * PREVIEW_START_FRACTION, PREVIEW_MAX_START_SECONDS)
          : 0;

      const previewPath = path.join(previewDir, `preview-${Date.now()}.mp4`);
      const throttlePercent = createProgressThrottle(120);

      const result = await brandVideo({
        videoPath,
        outputPath: previewPath,
        config,
        encodeProfile: 'preview',
        previewDurationSeconds: PREVIEW_DURATION_SECONDS,
        previewStartSeconds: start,
        shouldCancel: () => this.cancelled,
        registerChild: (child) => {
          this.currentChild = child;
        },
        onStep: (step) => {
          this.progress = {
            ...this.progress,
            currentStep: step,
            message: step,
            elapsedMs: Date.now() - this.startedAt,
          };
          this.emit('branding-progress');
        },
        onPercent: (percent) => {
          throttlePercent(() => {
            this.progress = {
              ...this.progress,
              currentVideoPercent: percent,
              progressPercent: percent,
              elapsedMs: Date.now() - this.startedAt,
            };
            this.emit('branding-progress');
          });
        },
      });
      throttlePercent.flush();

      if (this.cancelled) {
        this.finishCancelled();
        return;
      }

      this.progress = {
        ...this.progress,
        status: 'preview_ready',
        previewPath: result.outputPath,
        encoder: result.encoder,
        progressPercent: 100,
        currentVideoPercent: 100,
        completedVideos: 1,
        currentStep: null,
        elapsedMs: Date.now() - this.startedAt,
        message: `Preview ready (${result.encoder}, ${result.outputWidth}x${result.outputHeight}, ${config.canvas.aspectRatio})`,
        logs: this.pushLog(
          'success',
          `[Branding] Preview ready — encoder: ${result.encoder}, text renderer: ${
            getTextRendererName() ?? 'n/a'
          }`,
        ),
      };
      this.emit('branding-preview-ready');
    } catch (error) {
      this.handleJobError(error);
    } finally {
      this.endJob();
    }
  }

  async startBatch(request: BrandingBatchRequest): Promise<void> {
    if (!this.beginJob('batch')) {
      return;
    }

    const { folderPath, videos, outputFolder, config } = request;
    const results: BrandingReportEntry[] = [];

    this.progress = {
      ...this.progress,
      status: 'processing',
      selectedFolder: folderPath,
      outputFolder,
      totalVideos: videos.length,
      completedVideos: 0,
      failedVideos: 0,
      failedFiles: [],
      currentStep: 'Starting batch',
      message: 'Applying branding',
      logs: this.pushLog('info', `[Branding] Starting batch — ${videos.length} videos (one at a time)`),
    };
    this.emit('branding-started');

    try {
      this.assertReady(config);

      if (videos.length === 0) {
        throw new Error('No supported videos found in the selected folder.');
      }

      await fs.mkdir(outputFolder, { recursive: true });

      // Process one video fully before starting the next so progress advances
      // per completed output (1/N, 2/N, …) with a clear current-step label.
      for (let index = 0; index < videos.length; index += 1) {
        if (this.cancelled) {
          break;
        }

        const video = videos[index];
        const videoStartedAt = Date.now();

        this.progress = {
          ...this.progress,
          currentFile: video.name,
          currentVideoIndex: index + 1,
          currentVideoPercent: 0,
          currentStep: 'Reading video',
          message: `Processing ${video.name} (${index + 1}/${videos.length})`,
          elapsedMs: Date.now() - this.startedAt,
        };
        this.emit('branding-progress');

        try {
          if (path.resolve(path.dirname(video.path)) === path.resolve(outputFolder)) {
            throw new Error('Output folder must be different from the source folder');
          }

          const outputPath = await resolveBrandedOutputPath(outputFolder, video.name);
          const throttlePercent = createProgressThrottle(120);
          const result = await brandVideo({
            videoPath: video.path,
            outputPath,
            config,
            encodeProfile: 'export',
            shouldCancel: () => this.cancelled,
            registerChild: (child) => {
              this.currentChild = child;
            },
            onStep: (step) => {
              this.progress = {
                ...this.progress,
                currentStep: step,
                message: `${step} — ${video.name}`,
                elapsedMs: Date.now() - this.startedAt,
              };
              this.emit('branding-progress');
            },
            onPercent: (percent) => {
              throttlePercent(() => {
                const finished = this.progress.completedVideos + this.progress.failedVideos;
                this.progress = {
                  ...this.progress,
                  currentVideoPercent: percent,
                  progressPercent: formatPercent(finished + percent / 100, videos.length),
                  elapsedMs: Date.now() - this.startedAt,
                };
                this.emit('branding-progress');
              });
            },
          });
          throttlePercent.flush();

          results.push({
            video: video.name,
            status: 'branded',
            outputPath: result.outputPath,
            outputWidth: result.outputWidth,
            outputHeight: result.outputHeight,
            durationMs: Date.now() - videoStartedAt,
            encoder: result.encoder,
          });

          const completedVideos = this.progress.completedVideos + 1;
          this.progress = {
            ...this.progress,
            completedVideos,
            encoder: result.encoder,
            currentVideoPercent: 100,
            currentStep: 'Video complete',
            progressPercent: formatPercent(
              completedVideos + this.progress.failedVideos,
              videos.length,
            ),
            elapsedMs: Date.now() - this.startedAt,
            logs: this.pushLog('success', `✓ ${video.name} — branded (${result.encoder})`),
          };
          this.emit('branding-progress');
        } catch (error) {
          if (error instanceof ProcessingCancelledError || this.cancelled) {
            this.cancelled = true;
            break;
          }

          const reason = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            video: video.name,
            status: 'failed',
            durationMs: Date.now() - videoStartedAt,
            encoder: this.progress.encoder ?? 'unknown',
            reason,
          });

          const failedVideos = this.progress.failedVideos + 1;
          this.progress = {
            ...this.progress,
            failedVideos,
            failedFiles: [...this.progress.failedFiles, video.name],
            currentStep: 'Video failed',
            progressPercent: formatPercent(
              this.progress.completedVideos + failedVideos,
              videos.length,
            ),
            elapsedMs: Date.now() - this.startedAt,
            logs: this.pushLog('error', `✕ ${video.name} — failed\nReason: ${reason}`),
          };
          this.emit('branding-progress');
        }
      }

      if (this.cancelled) {
        await this.writeReport(outputFolder, results, config.canvas.aspectRatio);
        this.finishCancelled();
        return;
      }

      await this.writeReport(outputFolder, results, config.canvas.aspectRatio);

      this.progress = {
        ...this.progress,
        status: 'completed',
        currentFile: null,
        currentStep: null,
        progressPercent: 100,
        currentVideoPercent: 0,
        elapsedMs: Date.now() - this.startedAt,
        message: `Branding complete — branded: ${this.progress.completedVideos}, failed: ${this.progress.failedVideos}`,
        logs: this.pushLog(
          'info',
          `[Branding] Complete — branded: ${this.progress.completedVideos}, failed: ${this.progress.failedVideos}, output: ${outputFolder}`,
        ),
      };
      this.emit('branding-completed');
    } catch (error) {
      this.handleJobError(error);
    } finally {
      await disposeOverlayAssets();
      this.endJob();
    }
  }

  /** Remove temporary preview clips when the app shuts down. */
  async dispose(): Promise<void> {
    await disposeOverlayAssets();
    if (!this.previewDir) {
      return;
    }
    try {
      await fs.rm(this.previewDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    this.previewDir = null;
  }

  private assertReady(config: BrandingPreviewRequest['config']): void {
    const ffmpegStatus = assertFfmpegAvailable();
    if (!ffmpegStatus.available) {
      throw new Error(ffmpegStatus.error ?? 'FFmpeg is required for video branding');
    }
    if (!hasAnyBrandingEnabled(config)) {
      throw new Error(
        'Enable Watermark, Moving Text, a side image, a canvas format, zoom, an image preset, or subtitles first.',
      );
    }
    const invalidReason = validateBrandingConfig(config);
    if (invalidReason) {
      throw new Error(invalidReason);
    }
  }

  private beginJob(kind: 'preview' | 'batch'): boolean {
    if (this.running || this.isOtherJobRunning()) {
      return false;
    }
    this.running = true;
    this.cancelled = false;
    this.startedAt = Date.now();
    this.progress = {
      ...this.progress,
      jobKind: kind,
      currentVideoIndex: 0,
      currentVideoPercent: 0,
      currentStep: null,
      progressPercent: 0,
      elapsedMs: 0,
    };
    return true;
  }

  private endJob(): void {
    this.currentChild = null;
    this.running = false;
  }

  private handleJobError(error: unknown): void {
    if (error instanceof ProcessingCancelledError || this.cancelled) {
      this.finishCancelled();
      return;
    }

    const reason = error instanceof Error ? error.message : 'Unknown branding error';
    this.progress = {
      ...this.progress,
      status: 'error',
      currentStep: null,
      elapsedMs: Date.now() - this.startedAt,
      message: reason,
      logs: this.pushLog('error', `[Branding] Failed: ${reason}`),
    };
    this.emit('branding-failed');
  }

  private finishCancelled(): void {
    this.progress = {
      ...this.progress,
      status: 'cancelled',
      currentFile: null,
      currentStep: null,
      elapsedMs: Date.now() - this.startedAt,
      message: `Branding cancelled — branded: ${this.progress.completedVideos}, failed: ${this.progress.failedVideos}`,
      logs: this.pushLog('info', '[Branding] Cancelled by user'),
    };
    this.emit('branding-cancelled');
  }

  private async ensurePreviewDir(): Promise<string> {
    if (this.previewDir) {
      return this.previewDir;
    }
    this.previewDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfg-preview-'));
    return this.previewDir;
  }

  private async clearPreviewDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir);
      await Promise.all(entries.map((entry) => fs.unlink(path.join(dir, entry)).catch(() => {})));
    } catch {
      // ignore cleanup errors
    }
  }

  private async writeReport(
    outputFolder: string,
    results: BrandingReportEntry[],
    outputAspectRatio: BrandingBatchRequest['config']['canvas']['aspectRatio'],
  ): Promise<void> {
    const report: BrandingReport = {
      totalVideos: results.length,
      brandedVideos: results.filter((entry) => entry.status === 'branded').length,
      failedVideos: results.filter((entry) => entry.status === 'failed').length,
      outputFolder,
      encoder: this.progress.encoder ?? 'unknown',
      outputAspectRatio,
      results,
    };

    try {
      await fs.writeFile(
        path.join(outputFolder, BRANDING_REPORT_FILE),
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8',
      );
    } catch {
      // report is best-effort; branded videos are already on disk
    }
  }

  private pushLog(level: LogEntry['level'], message: string): LogEntry[] {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      message,
    };
    const next = [...this.progress.logs, entry];
    if (next.length > MAX_LOG_ENTRIES) {
      return next.slice(next.length - MAX_LOG_ENTRIES);
    }
    return next;
  }

  private emit(type: BrandingEventType): void {
    const event: BrandingEvent = {
      type,
      progress: this.cloneProgress(),
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private cloneProgress(): BrandingProgress {
    return {
      ...this.progress,
      logs: [...this.progress.logs],
      failedFiles: [...this.progress.failedFiles],
    };
  }
}

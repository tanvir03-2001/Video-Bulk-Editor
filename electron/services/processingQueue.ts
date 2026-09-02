import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  LogEntry,
  ProcessingProgress,
  ProgressEvent,
  ProgressEventType,
  StartProcessingRequest,
  VideoFile,
} from '../../shared/ipc';
import { INITIAL_PROGRESS } from '../../shared/ipc';
import {
  buildVideoFrameReport,
  selectAndSaveAdaptiveFrame,
  type VideoFrameReportEntry,
} from './adaptiveFrameSelector';
import {
  CLASSIFICATION_REPORT_FILE,
  clearRuntimeAllowPercent,
  getRuntimeAllowPercent,
  setRuntimeAllowPercent,
} from './classificationConfig';
import { assertFfmpegAvailable } from './ffmpegPaths';
import { ProcessingCancelledError, ensureOutputDirectory } from './frameGenerator';

type ProgressListener = (event: ProgressEvent) => void;

const MAX_LOG_ENTRIES = 50;

function formatProgressPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Number(((completed / total) * 100).toFixed(2));
}

export class ProcessingQueue {
  private cancelled = false;
  private running = false;
  private currentChild: ChildProcess | null = null;
  private listeners = new Set<ProgressListener>();
  private progress: ProcessingProgress = { ...INITIAL_PROGRESS, logs: [] };
  private startedAt = 0;

  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getProgress(): ProcessingProgress {
    return this.cloneProgress();
  }

  setFolderScan(folder: string, videos: VideoFile[]): void {
    const hasVideos = videos.length > 0;
    this.progress = {
      ...INITIAL_PROGRESS,
      selectedFolder: folder,
      totalVideos: videos.length,
      remainingVideos: videos.length,
      status: hasVideos ? 'ready' : 'no_videos',
      message: hasVideos
        ? `Found ${videos.length} video file${videos.length === 1 ? '' : 's'}. Ready to process.`
        : 'No video files found in the selected folder.',
      logs: [],
      ffmpegAvailable: this.progress.ffmpegAvailable,
      ffmpegError: this.progress.ffmpegError,
    };
    this.emit('scan-completed');
  }

  setFfmpegStatus(available: boolean, error: string | null): void {
    this.progress = {
      ...this.progress,
      ffmpegAvailable: available,
      ffmpegError: error,
    };
    this.emit('ffmpeg-status');
  }

  async start(request: StartProcessingRequest): Promise<void> {
    if (this.running) {
      return;
    }

    const { folderPath, videos, allowPercent } = request;

    const ffmpegStatus = assertFfmpegAvailable();
    this.setFfmpegStatus(ffmpegStatus.available, ffmpegStatus.error);

    if (!ffmpegStatus.available) {
      this.progress = {
        ...this.progress,
        status: 'error',
        message: ffmpegStatus.error,
      };
      this.emit('ffmpeg-status');
      return;
    }

    this.running = true;
    this.cancelled = false;
    this.startedAt = Date.now();
    setRuntimeAllowPercent(allowPercent);

    this.progress = {
      ...this.progress,
      selectedFolder: folderPath,
      status: 'processing',
      totalVideos: videos.length,
      completedVideos: 0,
      remainingVideos: videos.length,
      failedVideos: 0,
      imagesGenerated: 0,
      currentFile: null,
      currentImageIndex: 0,
      currentImageTotal: 0,
      progressPercent: 0,
      elapsedMs: 0,
      message: 'Selecting frames',
      currentStep: 'checking',
      logs: this.pushLog('info', `Allow threshold: ${allowPercent}% (scores above → flagged)`),
    };
    this.emit('processing-started');

    let outputDir: string;
    const reportEntries: VideoFrameReportEntry[] = [];

    try {
      outputDir = await ensureOutputDirectory(folderPath);
    } catch (error) {
      clearRuntimeAllowPercent();
      this.running = false;
      this.progress = {
        ...this.progress,
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create output folder',
      };
      this.emit('processing-progress');
      return;
    }

    try {
      for (let index = 0; index < videos.length; index += 1) {
        if (this.cancelled) {
          break;
        }

        const video = videos[index];
        this.progress = {
          ...this.progress,
          currentFile: video.name,
          currentImageIndex: 0,
          currentImageTotal: 0,
          remainingVideos: videos.length - index,
          message: 'Selecting & checking frame',
          currentStep: 'checking',
          elapsedMs: Date.now() - this.startedAt,
        };
        this.emit('video-started');

        try {
          const result = await selectAndSaveAdaptiveFrame(video.path, outputDir, {
            shouldCancel: () => this.cancelled,
            registerChild: (child) => {
              this.currentChild = child;
            },
            onProgress: ({ phase, current, total, message }) => {
              this.progress = {
                ...this.progress,
                currentStep: phase === 'retry' ? 'retrying' : 'checking',
                currentImageIndex: current,
                currentImageTotal: total,
                message,
                elapsedMs: Date.now() - this.startedAt,
              };
              this.emit('video-progress');
            },
          });

          reportEntries.push({
            video: video.name,
            status: result.status,
            maxRiskPercent: result.maxRiskPercent,
            attempts: result.attempts,
            selectedTimestamp: result.selectedTimestamp,
            reasons: result.reasons,
          });

          const completedVideos = this.progress.completedVideos + 1;
          const processed = completedVideos + this.progress.failedVideos;
          const statusNote =
            result.status === 'safe'
              ? `safe frame saved (max risk ${result.maxRiskPercent}%)`
              : `flagged frame saved after ${result.attempts} attempt${result.attempts === 1 ? '' : 's'} (max risk ${result.maxRiskPercent}%)`;

          this.progress = {
            ...this.progress,
            completedVideos,
            remainingVideos: Math.max(0, videos.length - processed),
            imagesGenerated: this.progress.imagesGenerated + result.imagesGenerated,
            progressPercent: formatProgressPercent(processed, videos.length),
            currentImageIndex: 1,
            currentImageTotal: 1,
            elapsedMs: Date.now() - this.startedAt,
            logs: this.pushLog('success', `✓ ${video.name} — ${statusNote}`),
          };
          this.emit('video-completed');
          this.emit('processing-progress');
        } catch (error) {
          if (error instanceof ProcessingCancelledError || this.cancelled) {
            this.cancelled = true;
            break;
          }

          const reason = error instanceof Error ? error.message : 'Unknown error';
          const failedVideos = this.progress.failedVideos + 1;
          const processed = this.progress.completedVideos + failedVideos;
          this.progress = {
            ...this.progress,
            failedVideos,
            remainingVideos: Math.max(0, videos.length - processed),
            progressPercent: formatProgressPercent(processed, videos.length),
            elapsedMs: Date.now() - this.startedAt,
            logs: this.pushLog(
              'error',
              `✕ ${video.name} — failed\nFailed: ${video.name}\nReason: ${reason}`,
            ),
          };
          this.emit('video-failed');
          this.emit('processing-progress');
        }
      }

      this.currentChild = null;

      const processedTotal = this.progress.completedVideos + this.progress.failedVideos;
      this.progress = {
        ...this.progress,
        currentFile: null,
        currentImageIndex: 0,
        currentImageTotal: 0,
        remainingVideos: Math.max(0, this.progress.totalVideos - processedTotal),
        elapsedMs: Date.now() - this.startedAt,
        progressPercent: formatProgressPercent(processedTotal, this.progress.totalVideos),
      };

      if (this.cancelled) {
        this.progress = {
          ...this.progress,
          status: 'cancelled',
          currentStep: 'done',
          message: `Processing Cancelled — Completed: ${this.progress.completedVideos}, Remaining: ${this.progress.remainingVideos}, Images Generated: ${this.progress.imagesGenerated}`,
          logs: this.pushLog('info', 'Processing cancelled by user'),
        };
        this.emit('processing-cancelled');
        return;
      }

      const report = buildVideoFrameReport(reportEntries, getRuntimeAllowPercent() ?? allowPercent);
      try {
        await fs.writeFile(
          path.join(outputDir, CLASSIFICATION_REPORT_FILE),
          `${JSON.stringify(report, null, 2)}\n`,
          'utf8',
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Failed to write classification report';
        this.progress = {
          ...this.progress,
          status: 'error',
          currentStep: 'done',
          message: reason,
          logs: this.pushLog('error', `Report write failed: ${reason}`),
        };
        this.emit('processing-progress');
        return;
      }

      this.progress = {
        ...this.progress,
        status: 'completed',
        currentStep: 'done',
        remainingVideos: 0,
        progressPercent: 100,
        message: `Processing Complete — safe: ${report.safeVideos}, flagged: ${report.flaggedVideos}`,
        currentFile: null,
        logs: this.pushLog(
          'info',
          `Frame selection complete — safe: ${report.safeVideos}, flagged: ${report.flaggedVideos}`,
        ),
      };
      this.emit('processing-completed');
    } catch (error) {
      if (error instanceof ProcessingCancelledError || this.cancelled) {
        this.progress = {
          ...this.progress,
          status: 'cancelled',
          currentStep: 'done',
          message: `Processing Cancelled — Completed: ${this.progress.completedVideos}, Remaining: ${this.progress.remainingVideos}, Images Generated: ${this.progress.imagesGenerated}`,
          logs: this.pushLog('info', 'Processing cancelled by user'),
        };
        this.emit('processing-cancelled');
        return;
      }

      const reason = error instanceof Error ? error.message : 'Processing failed';
      this.progress = {
        ...this.progress,
        status: 'error',
        currentStep: 'done',
        message: reason,
        logs: this.pushLog('error', `Processing failed: ${reason}`),
      };
      this.emit('processing-progress');
    } finally {
      clearRuntimeAllowPercent();
      this.currentChild = null;
      this.running = false;
    }
  }

  cancel(): void {
    if (!this.running) {
      return;
    }
    this.cancelled = true;
    if (this.currentChild && !this.currentChild.killed) {
      this.currentChild.kill('SIGTERM');
    }
  }

  isRunning(): boolean {
    return this.running;
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

  private emit(type: ProgressEventType): void {
    const event: ProgressEvent = {
      type,
      progress: this.cloneProgress(),
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private cloneProgress(): ProcessingProgress {
    return {
      ...this.progress,
      logs: [...this.progress.logs],
    };
  }
}

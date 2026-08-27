import type { ChildProcess } from 'node:child_process';
import type {
  ImageClassificationEvent,
  ImageClassificationProgress,
  LogEntry,
  StartImageClassificationRequest,
} from '../../shared/ipc';
import { INITIAL_IMAGE_CLASSIFICATION_PROGRESS } from '../../shared/ipc';
import { assertFfmpegAvailable } from './ffmpegPaths';
import {
  classifyGeneratedImages,
  type ClassificationReport,
} from './imageClassifier';
import { ProcessingCancelledError } from './frameGenerator';
import {
  clearRuntimeAllowPercent,
  setRuntimeAllowPercent,
} from './classificationConfig';
import {
  classifyVideosInFolder,
  type VideoClassificationReport,
} from './videoFileClassifier';

type ProgressListener = (event: ImageClassificationEvent) => void;

const MAX_LOG_ENTRIES = 50;

function formatProgressPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Number(((completed / total) * 100).toFixed(2));
}

export class ClassificationRunner {
  private cancelled = false;
  private running = false;
  private currentChild: ChildProcess | null = null;
  private listeners = new Set<ProgressListener>();
  private progress: ImageClassificationProgress = {
    ...INITIAL_IMAGE_CLASSIFICATION_PROGRESS,
    logs: [],
  };
  private startedAt = 0;
  private isVideoRunning: () => boolean;

  constructor(isVideoRunning: () => boolean) {
    this.isVideoRunning = isVideoRunning;
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

  getProgress(): ImageClassificationProgress {
    return this.cloneProgress();
  }

  async start(request: StartImageClassificationRequest): Promise<void> {
    if (this.running) {
      return;
    }
    if (this.isVideoRunning()) {
      throw new Error('Video processing is already running');
    }

    const { folderPath, imageCount, videos, allowPercent } = request;
    const videoMode = videos.length > 0;
    const imageMode = !videoMode && imageCount > 0;

    if (!videoMode && !imageMode) {
      throw new Error('No images or videos to classify');
    }

    if (videoMode) {
      const ffmpegStatus = assertFfmpegAvailable();
      if (!ffmpegStatus.available) {
        throw new Error(
          ffmpegStatus.error ?? 'FFmpeg is required to sample frames for video classification',
        );
      }
    }

    this.running = true;
    this.cancelled = false;
    this.startedAt = Date.now();
    setRuntimeAllowPercent(allowPercent);

    this.progress = {
      ...INITIAL_IMAGE_CLASSIFICATION_PROGRESS,
      selectedFolder: folderPath,
      status: 'classifying',
      imageCount: videoMode ? 0 : imageCount,
      videoCount: videos.length,
      processedCount: 0,
      currentFile: null,
      currentImageIndex: 0,
      currentImageTotal: 0,
      progressPercent: 0,
      message: videoMode ? 'Classifying videos' : 'Classifying images',
      currentStep: 'classifying',
      logs: [],
      elapsedMs: 0,
    };
    this.emit('classification-started');
    this.progress = {
      ...this.progress,
      logs: this.pushLog('info', `Allow threshold: ${allowPercent}% (scores above → flagged)`),
    };
    this.emit('classification-progress');

    try {
      if (videoMode) {
        await this.runVideoClassification(folderPath, videos);
      } else {
        await this.runImageClassification(folderPath, imageCount);
      }
    } catch (error) {
      if (error instanceof ProcessingCancelledError || this.cancelled) {
        this.finishCancelled();
        return;
      }
      const reason = error instanceof Error ? error.message : 'Unknown classification error';
      this.progress = {
        ...this.progress,
        status: 'error',
        currentStep: 'done',
        message: reason,
        elapsedMs: Date.now() - this.startedAt,
        logs: this.pushLog('error', `Classification failed: ${reason}`),
      };
      this.emit('classification-failed');
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

  private async runImageClassification(folderPath: string, imageCount: number): Promise<void> {
    this.progress = {
      ...this.progress,
      message: 'Classifying images',
      currentStep: 'classifying',
      imageCount,
      logs: this.pushLog('info', '[Image Classifier] Starting classification...'),
    };
    this.emit('classification-progress');

    const report = await classifyGeneratedImages(folderPath, {
      skipExisting: false,
      shouldCancel: () => this.cancelled,
      onLog: (level, message) => {
        this.progress = {
          ...this.progress,
          elapsedMs: Date.now() - this.startedAt,
          message: 'Classifying images',
          currentStep: 'classifying',
          logs: this.pushLog(level, message),
        };
        this.emit('classification-progress');
      },
      onItemProgress: ({ current, total, fileName }) => {
        this.progress = {
          ...this.progress,
          message: 'Classifying images',
          currentStep: 'classifying',
          currentFile: fileName,
          currentImageIndex: current,
          currentImageTotal: total,
          processedCount: current,
          progressPercent: formatProgressPercent(current, total),
          elapsedMs: Date.now() - this.startedAt,
        };
        this.emit('classification-progress');
      },
    });

    this.applyImageReport(report);

    if (this.cancelled) {
      this.finishCancelled();
      return;
    }

    this.progress = {
      ...this.progress,
      status: 'completed',
      currentStep: 'done',
      progressPercent: 100,
      currentFile: null,
      message: `Classification complete — safe: ${report.safeImages}, flagged: ${report.flaggedImages}, failed: ${report.classificationFailed}`,
      elapsedMs: Date.now() - this.startedAt,
      logs: this.pushLog('info', 'Image classification complete'),
    };
    this.emit('classification-completed');
  }

  private async runVideoClassification(
    folderPath: string,
    videos: StartImageClassificationRequest['videos'],
  ): Promise<void> {
    this.progress = {
      ...this.progress,
      message: 'Classifying videos',
      currentStep: 'classifying',
      videoCount: videos.length,
      logs: this.pushLog('info', '[Video Classifier] Starting classification...'),
    };
    this.emit('classification-progress');

    const report = await classifyVideosInFolder(folderPath, videos, {
      skipExisting: false,
      shouldCancel: () => this.cancelled,
      registerChild: (child) => {
        this.currentChild = child;
      },
      onLog: (level, message) => {
        this.progress = {
          ...this.progress,
          elapsedMs: Date.now() - this.startedAt,
          message: 'Classifying videos',
          currentStep: 'classifying',
          logs: this.pushLog(level, message),
        };
        this.emit('classification-progress');
      },
      onItemProgress: ({ current, total, fileName }) => {
        this.progress = {
          ...this.progress,
          message: 'Classifying videos',
          currentStep: 'classifying',
          currentFile: fileName,
          currentImageIndex: current,
          currentImageTotal: total,
          processedCount: current,
          progressPercent: formatProgressPercent(current, total),
          elapsedMs: Date.now() - this.startedAt,
        };
        this.emit('classification-progress');
      },
    });

    this.applyVideoReport(report);

    if (this.cancelled) {
      this.finishCancelled();
      return;
    }

    this.progress = {
      ...this.progress,
      status: 'completed',
      currentStep: 'done',
      progressPercent: 100,
      currentFile: null,
      message: `Classification complete — safe: ${report.safeVideos}, flagged: ${report.flaggedVideos}, failed: ${report.classificationFailed}`,
      elapsedMs: Date.now() - this.startedAt,
      logs: this.pushLog('info', 'Video classification complete'),
    };
    this.emit('classification-completed');
  }

  private finishCancelled(): void {
    this.progress = {
      ...this.progress,
      status: 'cancelled',
      currentStep: 'done',
      message: `Classification cancelled — processed ${this.progress.processedCount}`,
      elapsedMs: Date.now() - this.startedAt,
      logs: this.pushLog('info', 'Classification cancelled by user'),
    };
    this.emit('classification-cancelled');
  }

  private applyImageReport(report: ClassificationReport): void {
    this.progress = {
      ...this.progress,
      processedCount: report.totalImages,
      safeImages: report.safeImages,
      flaggedImages: report.flaggedImages,
      classificationFailed: report.classificationFailed,
      skipped: report.skipped,
      elapsedMs: Date.now() - this.startedAt,
    };
  }

  private applyVideoReport(report: VideoClassificationReport): void {
    this.progress = {
      ...this.progress,
      processedCount: report.totalVideos,
      safeImages: report.safeVideos,
      flaggedImages: report.flaggedVideos,
      classificationFailed: report.classificationFailed,
      skipped: report.skipped,
      elapsedMs: Date.now() - this.startedAt,
    };
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

  private emit(type: ImageClassificationEvent['type']): void {
    const event: ImageClassificationEvent = {
      type,
      progress: this.cloneProgress(),
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private cloneProgress(): ImageClassificationProgress {
    return {
      ...this.progress,
      logs: [...this.progress.logs],
    };
  }
}

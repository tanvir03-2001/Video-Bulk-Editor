import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  IMAGE_EDIT_REPORT_FILE,
  INITIAL_IMAGE_EDIT_PROGRESS,
  type ImageEditBatchRequest,
  type ImageEditEvent,
  type ImageEditEventType,
  type ImageEditPreviewRequest,
  type ImageEditProgress,
  type ImageEditReport,
  type ImageEditReportEntry,
} from '../../../shared/imageEditing';
import type { ImageFile, LogEntry } from '../../../shared/ipc';
import { ProcessingCancelledError } from '../frameGenerator';
import {
  isSupportedImageEditExtension,
  resolveDefaultImageEditOutputFolder,
  validateImageEditConfig,
} from './imageEditingConfig';
import {
  editImage,
  renderImagePreview,
  resolveEditedImagePath,
} from './imageEditor';

type ProgressListener = (event: ImageEditEvent) => void;

const MAX_LOG_ENTRIES = 50;

function formatPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Number(((completed / total) * 100).toFixed(2));
}

export class ImageEditingRunner {
  private cancelled = false;
  private running = false;
  private listeners = new Set<ProgressListener>();
  private progress: ImageEditProgress = {
    ...INITIAL_IMAGE_EDIT_PROGRESS,
    logs: [],
    failedFiles: [],
  };
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

  getProgress(): ImageEditProgress {
    return {
      ...this.progress,
      logs: [...this.progress.logs],
      failedFiles: [...this.progress.failedFiles],
    };
  }

  cancel(): void {
    if (this.running) {
      this.cancelled = true;
    }
  }

  async startPreview(request: ImageEditPreviewRequest): Promise<void> {
    if (!this.beginJob('preview')) {
      return;
    }

    this.progress = {
      ...this.progress,
      status: 'previewing',
      totalImages: 1,
      currentImageIndex: 1,
      currentFile: path.basename(request.imagePath),
      message: 'Rendering image preview',
    };
    this.emit('image-edit-started');

    try {
      this.assertReady(request.config);
      const previewDir = await this.ensurePreviewDir();
      await this.clearPreviewDir(previewDir);
      const previewPath = path.join(previewDir, `preview-${Date.now()}.png`);
      const result = await renderImagePreview(request.imagePath, previewPath, request.config);

      if (this.cancelled) {
        this.finishCancelled();
        return;
      }

      this.progress = {
        ...this.progress,
        status: 'preview_ready',
        currentFile: null,
        progressPercent: 100,
        completedImages: 1,
        elapsedMs: Date.now() - this.startedAt,
        previewPath: result.outputPath,
        previewWidth: result.outputWidth,
        previewHeight: result.outputHeight,
        message: `Preview ready (${result.outputWidth}x${result.outputHeight})`,
      };
      this.emit('image-edit-preview-ready');
    } catch (error) {
      this.handleError(error);
    } finally {
      this.endJob();
    }
  }

  async startBatch(request: ImageEditBatchRequest): Promise<void> {
    if (!this.beginJob('batch')) {
      return;
    }

    const results: ImageEditReportEntry[] = [];
    this.progress = {
      ...this.progress,
      status: 'processing',
      selectedFolder: request.folderPath,
      outputFolder: request.outputFolder,
      totalImages: request.images.length,
      completedImages: 0,
      failedImages: 0,
      currentImageIndex: 0,
      progressPercent: 0,
      currentFile: null,
      failedFiles: [],
      message: 'Applying edits',
    };
    this.emit('image-edit-started');

    try {
      this.assertReady(request.config);
      if (request.images.length === 0) {
        throw new Error('No supported images found in the selected folder.');
      }
      if (path.resolve(request.folderPath) === path.resolve(request.outputFolder)) {
        throw new Error('Output folder must be different from the source folder.');
      }
      await fs.mkdir(request.outputFolder, { recursive: true });

      for (let index = 0; index < request.images.length; index += 1) {
        if (this.cancelled) {
          break;
        }

        const image = request.images[index];
        const imageStartedAt = Date.now();
        this.progress = {
          ...this.progress,
          currentFile: image.name,
          currentImageIndex: index + 1,
          message: `Editing ${image.name}`,
        };
        this.emit('image-edit-progress');

        try {
          if (!isSupportedImageEditExtension(image.path)) {
            throw new Error(`Unsupported image format: ${image.name}`);
          }
          await fs.access(image.path);
          const outputPath = await resolveEditedImagePath(
            request.outputFolder,
            image.name,
            request.config.outputFormat,
          );
          const result = await editImage(
            image.path,
            outputPath,
            request.config,
            () => this.cancelled,
          );
          results.push({
            image: image.name,
            status: 'edited',
            outputPath: result.outputPath,
            outputWidth: result.outputWidth,
            outputHeight: result.outputHeight,
            durationMs: Date.now() - imageStartedAt,
          });

          const completedImages = this.progress.completedImages + 1;
          this.progress = {
            ...this.progress,
            completedImages,
            progressPercent: formatPercent(
              completedImages + this.progress.failedImages,
              request.images.length,
            ),
            elapsedMs: Date.now() - this.startedAt,
            logs: this.pushLog('success', `✓ ${image.name} — edited`),
          };
          this.emit('image-edit-progress');
        } catch (error) {
          if (error instanceof ProcessingCancelledError || this.cancelled) {
            this.cancelled = true;
            break;
          }

          const reason = error instanceof Error ? error.message : 'Unknown image edit error';
          results.push({
            image: image.name,
            status: 'failed',
            durationMs: Date.now() - imageStartedAt,
            reason,
          });
          const failedImages = this.progress.failedImages + 1;
          this.progress = {
            ...this.progress,
            failedImages,
            progressPercent: formatPercent(
              this.progress.completedImages + failedImages,
              request.images.length,
            ),
            failedFiles: [...this.progress.failedFiles, image.name],
            elapsedMs: Date.now() - this.startedAt,
            logs: this.pushLog('error', `✕ ${image.name} — failed\nReason: ${reason}`),
          };
          this.emit('image-edit-progress');
        }
      }

      await this.writeReport(request.outputFolder, request, results);
      if (this.cancelled) {
        this.finishCancelled();
        return;
      }

      this.progress = {
        ...this.progress,
        status: 'completed',
        currentFile: null,
        progressPercent: 100,
        elapsedMs: Date.now() - this.startedAt,
        message: `Editing complete — edited: ${this.progress.completedImages}, failed: ${this.progress.failedImages}`,
        logs: this.pushLog(
          'info',
          `[Image Editing] Complete — output: ${request.outputFolder}`,
        ),
      };
      this.emit('image-edit-completed');
    } catch (error) {
      this.handleError(error);
    } finally {
      this.endJob();
    }
  }

  async dispose(): Promise<void> {
    if (!this.previewDir) {
      return;
    }
    try {
      await fs.rm(this.previewDir, { recursive: true, force: true });
    } catch {
      // Preview cleanup is best effort.
    }
    this.previewDir = null;
  }

  private assertReady(config: ImageEditBatchRequest['config']): void {
    const validationError = validateImageEditConfig(config);
    if (validationError) {
      throw new Error(validationError);
    }
  }

  private beginJob(kind: ImageEditProgress['jobKind']): boolean {
    if (this.running || this.isOtherJobRunning()) {
      return false;
    }
    this.running = true;
    this.cancelled = false;
    this.startedAt = Date.now();
    this.progress = {
      ...this.progress,
      jobKind: kind,
      progressPercent: 0,
      elapsedMs: 0,
      previewPath: null,
      previewWidth: null,
      previewHeight: null,
    };
    return true;
  }

  private endJob(): void {
    this.running = false;
  }

  private handleError(error: unknown): void {
    if (error instanceof ProcessingCancelledError || this.cancelled) {
      this.finishCancelled();
      return;
    }
    const reason = error instanceof Error ? error.message : 'Unknown image edit error';
    this.progress = {
      ...this.progress,
      status: 'error',
      currentFile: null,
      elapsedMs: Date.now() - this.startedAt,
      message: reason,
      logs: this.pushLog('error', `[Image Editing] Failed: ${reason}`),
    };
    this.emit('image-edit-failed');
  }

  private finishCancelled(): void {
    this.progress = {
      ...this.progress,
      status: 'cancelled',
      currentFile: null,
      elapsedMs: Date.now() - this.startedAt,
      message: `Editing cancelled — edited: ${this.progress.completedImages}, failed: ${this.progress.failedImages}`,
      logs: this.pushLog('info', '[Image Editing] Cancelled by user'),
    };
    this.emit('image-edit-cancelled');
  }

  private async ensurePreviewDir(): Promise<string> {
    if (this.previewDir) {
      return this.previewDir;
    }
    this.previewDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfg-image-preview-'));
    return this.previewDir;
  }

  private async clearPreviewDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir);
      await Promise.all(entries.map((entry) => fs.unlink(path.join(dir, entry)).catch(() => {})));
    } catch {
      // Preview cleanup is best effort.
    }
  }

  private async writeReport(
    outputFolder: string,
    request: ImageEditBatchRequest,
    results: ImageEditReportEntry[],
  ): Promise<void> {
    const report: ImageEditReport = {
      totalImages: results.length,
      editedImages: results.filter((entry) => entry.status === 'edited').length,
      failedImages: results.filter((entry) => entry.status === 'failed').length,
      outputFolder,
      outputFormat: request.config.outputFormat,
      filter: request.config.filter,
      presetId: request.config.presetId,
      presetName: request.config.presetName,
      results,
    };
    try {
      await fs.writeFile(
        path.join(outputFolder, IMAGE_EDIT_REPORT_FILE),
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8',
      );
    } catch {
      // The report is best effort; edited files are already on disk.
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
    return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
  }

  private emit(type: ImageEditEventType): void {
    const event: ImageEditEvent = {
      type,
      progress: {
        ...this.progress,
        logs: [...this.progress.logs],
        failedFiles: [...this.progress.failedFiles],
      },
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export function resolveImageEditOutputFolder(folderPath: string): string {
  return resolveDefaultImageEditOutputFolder(folderPath);
}

export function cloneImageList(images: ImageFile[]): ImageFile[] {
  return images.map((image) => ({ ...image }));
}

import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { VideoFile } from '../../shared/ipc';
import {
  FLAGGED_VIDEOS_DIR,
  calculateVideoSampleCount,
  getClassificationConfig,
  getRuntimeAllowPercent,
  scoreToPercent,
  SAFE_VIDEOS_DIR,
  VIDEO_CLASSIFICATION_REPORT_FILE,
} from './classificationConfig';
import {
  ProcessingCancelledError,
  extractSampleFramesToDirectory,
  getVideoDurationSeconds,
} from './frameGenerator';
import { classifyImageWithModel } from './localRiskModel';

export type VideoFileClassificationStatus =
  | 'safe'
  | 'flagged'
  | 'classification_failed'
  | 'skipped';

export interface VideoFileClassificationResult {
  video: string;
  status: VideoFileClassificationStatus;
  detections: Array<{ category: string; confidence: number }>;
  reasons: string[];
  maxRiskPercent?: number;
  allowPercent?: number;
  reason?: string;
}

export interface VideoClassificationReport {
  totalVideos: number;
  safeVideos: number;
  flaggedVideos: number;
  classificationFailed: number;
  skipped: number;
  allowPercent?: number;
  results: VideoFileClassificationResult[];
}

export interface ClassifyVideosInFolderOptions {
  onLog?: (level: 'info' | 'success' | 'error', message: string) => void;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
  /** When false, re-classify even if a copy already exists in safe/flagged output folders. */
  skipExisting?: boolean;
  onItemProgress?: (info: {
    current: number;
    total: number;
    fileName: string;
  }) => void;
}

const LOG_PREFIX = '[Video Classifier]';

function log(
  onLog: ClassifyVideosInFolderOptions['onLog'],
  level: 'info' | 'success' | 'error',
  message: string,
): void {
  const line = `${LOG_PREFIX} ${message}`;
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
  onLog?.(level, line);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureVideoFolders(folderPath: string): Promise<{
  safeDir: string;
  flaggedDir: string;
}> {
  const safeDir = path.join(folderPath, SAFE_VIDEOS_DIR);
  const flaggedDir = path.join(folderPath, FLAGGED_VIDEOS_DIR);
  await fs.mkdir(safeDir, { recursive: true });
  await fs.mkdir(flaggedDir, { recursive: true });
  return { safeDir, flaggedDir };
}

async function alreadyClassified(
  fileName: string,
  safeDir: string,
  flaggedDir: string,
): Promise<boolean> {
  const inSafe = await pathExists(path.join(safeDir, fileName));
  const inFlagged = await pathExists(path.join(flaggedDir, fileName));
  return inSafe || inFlagged;
}

async function removeDirQuiet(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

async function removeFileQuiet(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
}

async function copyToOutputFolder(
  sourcePath: string,
  destinationDir: string,
  oppositeDir: string,
  fileName: string,
): Promise<void> {
  await fs.copyFile(sourcePath, path.join(destinationDir, fileName));
  await removeFileQuiet(path.join(oppositeDir, fileName));
}

async function classifyOneVideo(
  video: VideoFile,
  index: number,
  total: number,
  safeDir: string,
  flaggedDir: string,
  skipExisting: boolean,
  options: ClassifyVideosInFolderOptions,
): Promise<VideoFileClassificationResult> {
  const { onLog, shouldCancel, registerChild, onItemProgress } = options;
  const fileName = video.name;

  onItemProgress?.({ current: index + 1, total, fileName });
  log(onLog, 'info', `Processing video ${index + 1}/${total}: ${fileName}`);

  if (skipExisting && (await alreadyClassified(fileName, safeDir, flaggedDir))) {
    log(onLog, 'info', `SKIPPED (already classified): ${fileName}`);
    return {
      video: fileName,
      status: 'skipped',
      detections: [],
      reasons: [],
      reason: 'already classified',
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfg-vid-class-'));

  try {
    if (shouldCancel?.()) {
      throw new ProcessingCancelledError();
    }

    const duration = await getVideoDurationSeconds(video.path, shouldCancel, registerChild);
    const sampleCount = calculateVideoSampleCount(duration);
    log(
      onLog,
      'info',
      `Thorough sample: ${sampleCount} frames across ${duration.toFixed(1)}s (start→end): ${fileName}`,
    );

    const framePaths = await extractSampleFramesToDirectory(video.path, tempDir, sampleCount, {
      shouldCancel,
      registerChild,
      onImageProgress: (current, sampleTotal) => {
        onItemProgress?.({
          current: index + 1,
          total,
          fileName: `${fileName} (frame ${current}/${sampleTotal})`,
        });
      },
    });

    const reasonSet = new Set<string>();
    const detectionMap = new Map<string, { category: string; confidence: number }>();

    for (const framePath of framePaths) {
      if (shouldCancel?.()) {
        throw new ProcessingCancelledError();
      }

      const modelResult = await classifyImageWithModel(framePath);
      for (const detection of modelResult.detections) {
        reasonSet.add(detection.category);
        const existing = detectionMap.get(detection.category);
        if (!existing || detection.confidence > existing.confidence) {
          detectionMap.set(detection.category, {
            category: detection.category,
            confidence: detection.confidence,
          });
        }
      }
      for (const reason of modelResult.reasons) {
        reasonSet.add(reason);
      }
    }

    const detections = [...detectionMap.values()];
    const reasons = [...reasonSet];
    const maxRiskPercent =
      detections.length > 0
        ? Math.max(...detections.map((detection) => scoreToPercent(detection.confidence)))
        : 0;
    const allowPercent = getRuntimeAllowPercent() ?? undefined;

    if (reasons.length > 0) {
      await copyToOutputFolder(video.path, flaggedDir, safeDir, fileName);
      log(onLog, 'info', `FLAGGED: ${fileName}`);
      log(onLog, 'info', `Max risk: ${maxRiskPercent}%${allowPercent !== undefined ? ` (allow ${allowPercent}%)` : ''}`);
      log(onLog, 'info', `Reasons: ${reasons.join(', ')}`);
      return {
        video: fileName,
        status: 'flagged',
        detections,
        reasons,
        maxRiskPercent,
        allowPercent,
      };
    }

    await copyToOutputFolder(video.path, safeDir, flaggedDir, fileName);
    log(onLog, 'success', `SAFE: ${fileName}`);
    log(
      onLog,
      'info',
      `Max risk: ${maxRiskPercent}%${allowPercent !== undefined ? ` (allow ${allowPercent}%)` : ''}`,
    );
    return {
      video: fileName,
      status: 'safe',
      detections: [],
      reasons: [],
      maxRiskPercent,
      allowPercent,
    };
  } catch (error) {
    if (error instanceof ProcessingCancelledError) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : 'model inference error';
    log(onLog, 'error', `FAILED: ${fileName} — ${reason}`);
    return {
      video: fileName,
      status: 'classification_failed',
      detections: [],
      reasons: [],
      reason,
    };
  } finally {
    registerChild?.(null);
    await removeDirQuiet(tempDir);
  }
}

/**
 * Classify top-level videos in a folder by sampling temporary frames.
 * Copies each video into safe-videos/ or flagged-videos/. Does not create Generated Images.
 */
export async function classifyVideosInFolder(
  folderPath: string,
  videos: VideoFile[],
  options: ClassifyVideosInFolderOptions = {},
): Promise<VideoClassificationReport> {
  const config = getClassificationConfig();
  const { onLog, shouldCancel } = options;
  const skipExisting = options.skipExisting ?? config.skipExisting;

  if (!config.enabled) {
    log(onLog, 'info', 'Classification disabled via IMAGE_CLASSIFICATION_ENABLED');
    return {
      totalVideos: 0,
      safeVideos: 0,
      flaggedVideos: 0,
      classificationFailed: 0,
      skipped: 0,
      results: [],
    };
  }

  log(onLog, 'info', 'Starting video classification...');
  const { safeDir, flaggedDir } = await ensureVideoFolders(folderPath);

  log(onLog, 'info', `Found ${videos.length} videos`);

  if (videos.length === 0) {
    const emptyReport: VideoClassificationReport = {
      totalVideos: 0,
      safeVideos: 0,
      flaggedVideos: 0,
      classificationFailed: 0,
      skipped: 0,
      results: [],
    };
    await fs.writeFile(
      path.join(folderPath, VIDEO_CLASSIFICATION_REPORT_FILE),
      `${JSON.stringify(emptyReport, null, 2)}\n`,
      'utf8',
    );
    log(onLog, 'info', 'Video classification completed');
    return emptyReport;
  }

  const results: VideoFileClassificationResult[] = [];

  for (let index = 0; index < videos.length; index += 1) {
    if (shouldCancel?.()) {
      break;
    }

    const result = await classifyOneVideo(
      videos[index],
      index,
      videos.length,
      safeDir,
      flaggedDir,
      skipExisting,
      options,
    );
    results.push(result);
  }

  const reportAllowPercent = getRuntimeAllowPercent() ?? undefined;
  const report: VideoClassificationReport = {
    totalVideos: results.length,
    safeVideos: results.filter((r) => r.status === 'safe').length,
    flaggedVideos: results.filter((r) => r.status === 'flagged').length,
    classificationFailed: results.filter((r) => r.status === 'classification_failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    allowPercent: reportAllowPercent,
    results,
  };

  await fs.writeFile(
    path.join(folderPath, VIDEO_CLASSIFICATION_REPORT_FILE),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  log(
    onLog,
    'info',
    `Video classification completed — safe: ${report.safeVideos}, flagged: ${report.flaggedVideos}, failed: ${report.classificationFailed}, skipped: ${report.skipped}`,
  );

  return report;
}

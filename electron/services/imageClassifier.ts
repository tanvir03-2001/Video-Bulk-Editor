import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CLASSIFICATION_REPORT_FILE,
  FLAGGED_IMAGES_DIR,
  getClassificationConfig,
  isSupportedImageExtension,
  SAFE_IMAGES_DIR,
} from './classificationConfig';
import { classifyImageWithModel } from './localRiskModel';

export type ImageClassificationStatus = 'safe' | 'flagged' | 'classification_failed' | 'skipped';

export interface ImageClassificationResult {
  image: string;
  status: ImageClassificationStatus;
  detections: Array<{ category: string; confidence: number }>;
  scores: Record<string, number>;
  reasons: string[];
  reason?: string;
}

export interface ClassificationReport {
  totalImages: number;
  safeImages: number;
  flaggedImages: number;
  classificationFailed: number;
  skipped: number;
  results: ImageClassificationResult[];
}

export interface ClassifyGeneratedImagesOptions {
  onLog?: (level: 'info' | 'success' | 'error', message: string) => void;
  shouldCancel?: () => boolean;
  /** When false, re-classify even if a copy already exists in safe/flagged output folders. */
  skipExisting?: boolean;
  onItemProgress?: (info: {
    current: number;
    total: number;
    fileName: string;
  }) => void;
}

const LOG_PREFIX = '[Image Classifier]';

function log(
  onLog: ClassifyGeneratedImagesOptions['onLog'],
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

async function listTopLevelImages(outputDir: string): Promise<string[]> {
  const entries = await fs.readdir(outputDir, { withFileTypes: true });
  const images: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (entry.name === CLASSIFICATION_REPORT_FILE) {
      continue;
    }
    if (!isSupportedImageExtension(entry.name)) {
      continue;
    }
    images.push(path.join(outputDir, entry.name));
  }

  images.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  return images;
}

async function ensureClassificationFolders(outputDir: string): Promise<{
  safeDir: string;
  flaggedDir: string;
}> {
  const safeDir = path.join(outputDir, SAFE_IMAGES_DIR);
  const flaggedDir = path.join(outputDir, FLAGGED_IMAGES_DIR);
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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  shouldCancel: (() => boolean) | undefined,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    let active = true;
    while (active) {
      if (shouldCancel?.()) {
        active = false;
        continue;
      }
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) {
        active = false;
        continue;
      }
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
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

async function classifySingleImage(
  imagePath: string,
  index: number,
  total: number,
  safeDir: string,
  flaggedDir: string,
  skipExisting: boolean,
  onLog: ClassifyGeneratedImagesOptions['onLog'],
  onItemProgress: ClassifyGeneratedImagesOptions['onItemProgress'],
): Promise<ImageClassificationResult> {
  const fileName = path.basename(imagePath);
  onItemProgress?.({ current: index + 1, total, fileName });
  log(onLog, 'info', `Processing image ${index + 1}/${total}`);

  if (skipExisting && (await alreadyClassified(fileName, safeDir, flaggedDir))) {
    log(onLog, 'info', `SKIPPED (already classified): ${fileName}`);
    return {
      image: fileName,
      status: 'skipped',
      detections: [],
      scores: {},
      reasons: [],
      reason: 'already classified',
    };
  }

  try {
    const modelResult = await classifyImageWithModel(imagePath);

    if (modelResult.reasons.length > 0) {
      await copyToOutputFolder(imagePath, flaggedDir, safeDir, fileName);
      log(onLog, 'info', `FLAGGED: ${fileName}`);
      log(onLog, 'info', `Reasons: ${modelResult.reasons.join(', ')}`);
      return {
        image: fileName,
        status: 'flagged',
        detections: modelResult.detections,
        scores: modelResult.scores,
        reasons: modelResult.reasons,
      };
    }

    await copyToOutputFolder(imagePath, safeDir, flaggedDir, fileName);
    log(onLog, 'success', `SAFE: ${fileName}`);
    return {
      image: fileName,
      status: 'safe',
      detections: [],
      scores: modelResult.scores,
      reasons: [],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'model inference error';
    log(onLog, 'error', `FAILED: ${fileName} — ${reason}`);
    return {
      image: fileName,
      status: 'classification_failed',
      detections: [],
      scores: {},
      reasons: [],
      reason,
    };
  }
}

/**
 * Classify all top-level generated images in the existing output folder.
 * Originals are never deleted; results are copied into safe-images / flagged-images.
 */
export async function classifyGeneratedImages(
  outputDir: string,
  options: ClassifyGeneratedImagesOptions = {},
): Promise<ClassificationReport> {
  const config = getClassificationConfig();
  const { onLog, shouldCancel, onItemProgress } = options;
  const skipExisting = options.skipExisting ?? config.skipExisting;

  if (!config.enabled) {
    log(onLog, 'info', 'Classification disabled via IMAGE_CLASSIFICATION_ENABLED');
    return {
      totalImages: 0,
      safeImages: 0,
      flaggedImages: 0,
      classificationFailed: 0,
      skipped: 0,
      results: [],
    };
  }

  log(onLog, 'info', 'Starting classification...');

  const { safeDir, flaggedDir } = await ensureClassificationFolders(outputDir);
  const images = await listTopLevelImages(outputDir);

  log(onLog, 'info', `Found ${images.length} images`);

  if (images.length === 0) {
    const emptyReport: ClassificationReport = {
      totalImages: 0,
      safeImages: 0,
      flaggedImages: 0,
      classificationFailed: 0,
      skipped: 0,
      results: [],
    };
    await fs.writeFile(
      path.join(outputDir, CLASSIFICATION_REPORT_FILE),
      `${JSON.stringify(emptyReport, null, 2)}\n`,
      'utf8',
    );
    log(onLog, 'info', 'Classification completed');
    return emptyReport;
  }

  const results = await mapWithConcurrency(
    images,
    config.concurrency,
    shouldCancel,
    (imagePath, index) =>
      classifySingleImage(
        imagePath,
        index,
        images.length,
        safeDir,
        flaggedDir,
        skipExisting,
        onLog,
        onItemProgress,
      ),
  );

  // Filter undefined if cancelled mid-run
  const completedResults = results.filter((r): r is ImageClassificationResult => Boolean(r));

  const report: ClassificationReport = {
    totalImages: completedResults.length,
    safeImages: completedResults.filter((r) => r.status === 'safe').length,
    flaggedImages: completedResults.filter((r) => r.status === 'flagged').length,
    classificationFailed: completedResults.filter((r) => r.status === 'classification_failed')
      .length,
    skipped: completedResults.filter((r) => r.status === 'skipped').length,
    results: completedResults,
  };

  await fs.writeFile(
    path.join(outputDir, CLASSIFICATION_REPORT_FILE),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  log(
    onLog,
    'info',
    `Classification completed — safe: ${report.safeImages}, flagged: ${report.flaggedImages}, failed: ${report.classificationFailed}, skipped: ${report.skipped}`,
  );

  return report;
}

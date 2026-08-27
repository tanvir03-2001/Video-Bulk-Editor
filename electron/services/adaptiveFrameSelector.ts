import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  FLAGGED_IMAGES_DIR,
  SAFE_IMAGES_DIR,
  VIDEO_PROBE_FRAME_MAX,
  VIDEO_SAFE_RETRY_MAX,
} from './classificationConfig';
import {
  extractSingleFrameAtTimestamp,
  measureSharpness,
} from './frameQuality';
import {
  ProcessingCancelledError,
  calculateImageCount,
  calculateTimestamps,
  getVideoDurationSeconds,
  resolveUniqueImagePath,
} from './frameGenerator';
import { classifyImageWithModel } from './localRiskModel';
import { getMaxRiskPercent, isFrameFlagged } from './frameRiskCheck';

export type AdaptiveFrameStatus = 'safe' | 'flagged';

export interface AdaptiveFrameResult {
  imagesGenerated: number;
  status: AdaptiveFrameStatus;
  maxRiskPercent: number;
  attempts: number;
  selectedTimestamp: number;
  reasons: string[];
}

export interface AdaptiveFrameCallbacks {
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
  onProgress?: (info: {
    phase: 'probe' | 'retry';
    current: number;
    total: number;
    message: string;
  }) => void;
}

interface FrameCandidate {
  framePath: string;
  timestamp: number;
  flagged: boolean;
  sharpness: number;
  maxRiskPercent: number;
  reasons: string[];
}

function calculateProbeFrameCount(durationSeconds: number): number {
  return Math.min(VIDEO_PROBE_FRAME_MAX, calculateImageCount(durationSeconds));
}

/**
 * Pick evenly spaced timestamps that are not too close to already-tried positions.
 */
export function calculateRetryTimestamps(
  durationSeconds: number,
  usedTimestamps: number[],
  count: number,
): number[] {
  if (count <= 0) {
    return [];
  }

  const epsilon = Math.min(0.05, durationSeconds / 4);
  const minGap = Math.max(0.5, durationSeconds * 0.04);
  const tried = [...usedTimestamps];
  const results: number[] = [];

  for (let slot = 1; slot <= count * 4 && results.length < count; slot += 1) {
    const phase = slot / (count * 4 + 1);
    let timestamp = phase * durationSeconds;
    timestamp = Math.max(epsilon, Math.min(durationSeconds - epsilon, timestamp));

    const tooClose = tried.some((existing) => Math.abs(existing - timestamp) < minGap);
    if (tooClose) {
      continue;
    }

    tried.push(timestamp);
    results.push(timestamp);
  }

  return results;
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

async function ensureClassificationOutputFolders(outputDir: string): Promise<{
  safeDir: string;
  flaggedDir: string;
}> {
  const safeDir = path.join(outputDir, SAFE_IMAGES_DIR);
  const flaggedDir = path.join(outputDir, FLAGGED_IMAGES_DIR);
  await fs.mkdir(safeDir, { recursive: true });
  await fs.mkdir(flaggedDir, { recursive: true });
  return { safeDir, flaggedDir };
}

async function extractAndEvaluateFrame(
  videoPath: string,
  tempDir: string,
  timestamp: number,
  index: number,
  callbacks: AdaptiveFrameCallbacks,
): Promise<FrameCandidate> {
  const framePath = path.join(tempDir, `frame_${String(index).padStart(3, '0')}.jpg`);
  await extractSingleFrameAtTimestamp(videoPath, framePath, timestamp, {
    shouldCancel: callbacks.shouldCancel,
    registerChild: callbacks.registerChild,
  });

  const modelResult = await classifyImageWithModel(framePath);
  const flagged = isFrameFlagged(modelResult);
  const sharpness = await measureSharpness(framePath);

  return {
    framePath,
    timestamp,
    flagged,
    sharpness,
    maxRiskPercent: getMaxRiskPercent(modelResult),
    reasons: modelResult.reasons,
  };
}

function pickSharpest(candidates: FrameCandidate[]): FrameCandidate {
  return candidates.reduce((best, current) =>
    current.sharpness > best.sharpness ? current : best,
  );
}

async function saveFinalFrame(
  candidate: FrameCandidate,
  videoPath: string,
  outputDir: string,
  safeDir: string,
  flaggedDir: string,
): Promise<void> {
  const videoBaseName = path.parse(videoPath).name;
  const finalPath = await resolveUniqueImagePath(outputDir, videoBaseName, 1);
  const fileName = path.basename(finalPath);

  await fs.copyFile(candidate.framePath, finalPath);

  const destinationDir = candidate.flagged ? flaggedDir : safeDir;
  const oppositeDir = candidate.flagged ? safeDir : flaggedDir;
  await fs.copyFile(finalPath, path.join(destinationDir, fileName));
  await removeFileQuiet(path.join(oppositeDir, fileName));
}

/**
 * Adaptive per-video frame selection: probe 1–3 frames, classify inline,
 * retry up to 5 times if flagged, pick sharpest safe (or sharpest flagged fallback).
 */
export async function selectAndSaveAdaptiveFrame(
  videoPath: string,
  outputDir: string,
  callbacks: AdaptiveFrameCallbacks = {},
): Promise<AdaptiveFrameResult> {
  if (callbacks.shouldCancel?.()) {
    throw new ProcessingCancelledError();
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfg-adaptive-'));
  const { safeDir, flaggedDir } = await ensureClassificationOutputFolders(outputDir);
  const allCandidates: FrameCandidate[] = [];
  let attemptIndex = 0;

  try {
    const duration = await getVideoDurationSeconds(
      videoPath,
      callbacks.shouldCancel,
      callbacks.registerChild,
    );

    const probeCount = calculateProbeFrameCount(duration);
    const probeTimestamps = calculateTimestamps(duration, probeCount);
    const usedTimestamps: number[] = [];

    for (let i = 0; i < probeTimestamps.length; i += 1) {
      if (callbacks.shouldCancel?.()) {
        throw new ProcessingCancelledError();
      }

      attemptIndex += 1;
      callbacks.onProgress?.({
        phase: 'probe',
        current: i + 1,
        total: probeCount,
        message: `Extracting & checking frame ${i + 1}/${probeCount}`,
      });

      const timestamp = probeTimestamps[i];
      usedTimestamps.push(timestamp);
      const candidate = await extractAndEvaluateFrame(
        videoPath,
        tempDir,
        timestamp,
        attemptIndex,
        callbacks,
      );
      allCandidates.push(candidate);
    }

    let safeCandidates = allCandidates.filter((c) => !c.flagged);
    if (safeCandidates.length > 0) {
      const winner = pickSharpest(safeCandidates);
      await saveFinalFrame(winner, videoPath, outputDir, safeDir, flaggedDir);
      return {
        imagesGenerated: 1,
        status: 'safe',
        maxRiskPercent: winner.maxRiskPercent,
        attempts: allCandidates.length,
        selectedTimestamp: winner.timestamp,
        reasons: [],
      };
    }

    const retryTimestamps = calculateRetryTimestamps(
      duration,
      usedTimestamps,
      VIDEO_SAFE_RETRY_MAX,
    );

    for (let i = 0; i < retryTimestamps.length; i += 1) {
      if (callbacks.shouldCancel?.()) {
        throw new ProcessingCancelledError();
      }

      attemptIndex += 1;
      callbacks.onProgress?.({
        phase: 'retry',
        current: i + 1,
        total: retryTimestamps.length,
        message: `Retrying safe frame (${i + 1}/${retryTimestamps.length})`,
      });

      const timestamp = retryTimestamps[i];
      usedTimestamps.push(timestamp);
      const candidate = await extractAndEvaluateFrame(
        videoPath,
        tempDir,
        timestamp,
        attemptIndex,
        callbacks,
      );
      allCandidates.push(candidate);

      if (!candidate.flagged) {
        safeCandidates = allCandidates.filter((c) => !c.flagged);
        const winner = pickSharpest(safeCandidates);
        await saveFinalFrame(winner, videoPath, outputDir, safeDir, flaggedDir);
        return {
          imagesGenerated: 1,
          status: 'safe',
          maxRiskPercent: winner.maxRiskPercent,
          attempts: allCandidates.length,
          selectedTimestamp: winner.timestamp,
          reasons: [],
        };
      }
    }

    const fallback = pickSharpest(allCandidates);
    await saveFinalFrame(fallback, videoPath, outputDir, safeDir, flaggedDir);
    return {
      imagesGenerated: 1,
      status: 'flagged',
      maxRiskPercent: fallback.maxRiskPercent,
      attempts: allCandidates.length,
      selectedTimestamp: fallback.timestamp,
      reasons: fallback.reasons,
    };
  } finally {
    callbacks.registerChild?.(null);
    await removeDirQuiet(tempDir);
  }
}

export interface VideoFrameReportEntry {
  video: string;
  status: AdaptiveFrameStatus;
  maxRiskPercent: number;
  attempts: number;
  selectedTimestamp: number;
  reasons: string[];
}

export interface VideoFrameSelectionReport {
  totalVideos: number;
  safeVideos: number;
  flaggedVideos: number;
  allowPercent?: number;
  results: VideoFrameReportEntry[];
}

export function buildVideoFrameReport(
  entries: VideoFrameReportEntry[],
  allowPercent?: number,
): VideoFrameSelectionReport {
  return {
    totalVideos: entries.length,
    safeVideos: entries.filter((e) => e.status === 'safe').length,
    flaggedVideos: entries.filter((e) => e.status === 'flagged').length,
    allowPercent,
    results: entries,
  };
}

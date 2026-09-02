import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractSingleFrameAtTimestamp, measureSharpness } from '../frameQuality';
import { ProcessingCancelledError } from '../frameGenerator';

export interface BestSegmentResult {
  startSeconds: number;
  durationSeconds: number;
  sharpness: number;
}

interface BestSegmentOptions {
  videoPath: string;
  durationSeconds: number;
  clipDurationSeconds: number;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
}

const SAMPLE_COUNT = 3;

/**
 * Sample frames from the middle 60% of a video and return the sharpest segment.
 */
export async function findBestSegment(
  options: BestSegmentOptions,
): Promise<BestSegmentResult> {
  const { videoPath, durationSeconds, clipDurationSeconds, shouldCancel, registerChild } = options;
  const safeDuration = Math.max(clipDurationSeconds + 0.2, durationSeconds);
  const windowStart = safeDuration * 0.2;
  const windowEnd = safeDuration * 0.8;
  const sampleCount = Math.min(SAMPLE_COUNT, Math.max(1, Math.floor(safeDuration)));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfg-best-frame-'));

  try {
    const timestamps = Array.from({ length: sampleCount }, (_, index) => {
      const phase = (index + 1) / (sampleCount + 1);
      return windowStart + phase * (windowEnd - windowStart);
    });

    const samples = await Promise.all(
      timestamps.map(async (timestamp, index) => {
        if (shouldCancel?.()) {
          throw new ProcessingCancelledError();
        }

        const framePath = path.join(tempDir, `frame-${index}.jpg`);
        await extractSingleFrameAtTimestamp(videoPath, framePath, timestamp, {
          shouldCancel,
          registerChild,
        });
        const sharpness = await measureSharpness(framePath);
        return { timestamp, sharpness };
      }),
    );

    const best = samples.reduce(
      (winner, sample) => (sample.sharpness > winner.sharpness ? sample : winner),
      samples[0] ?? { timestamp: safeDuration / 2, sharpness: -1 },
    );

    const halfClip = clipDurationSeconds / 2;
    const startSeconds = Math.max(
      0,
      Math.min(best.timestamp - halfClip, safeDuration - clipDurationSeconds),
    );

    return {
      startSeconds,
      durationSeconds: Math.min(clipDurationSeconds, safeDuration - startSeconds),
      sharpness: best.sharpness,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

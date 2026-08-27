import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getFfmpegPath, getFfprobePath } from './ffmpegPaths';

export class ProcessingCancelledError extends Error {
  constructor(message = 'Processing cancelled') {
    super(message);
    this.name = 'ProcessingCancelledError';
  }
}

export interface FrameExtractionCallbacks {
  onImageProgress?: (current: number, total: number) => void;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
}

function runProcess(
  binary: string,
  args: string[],
  registerChild?: (child: ChildProcess | null) => void,
  shouldCancel?: () => boolean,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (shouldCancel?.()) {
      reject(new ProcessingCancelledError());
      return;
    }

    const child = spawn(binary, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    registerChild?.(child);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    const cancelPoll = setInterval(() => {
      if (shouldCancel?.()) {
        clearInterval(cancelPoll);
        child.kill('SIGTERM');
      }
    }, 200);

    child.on('error', (error) => {
      clearInterval(cancelPoll);
      registerChild?.(null);
      reject(error);
    });

    child.on('close', (code, signal) => {
      clearInterval(cancelPoll);
      registerChild?.(null);

      if (shouldCancel?.()) {
        reject(new ProcessingCancelledError());
        return;
      }

      if (signal) {
        reject(new Error(`Process terminated by signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(stderr.trim() || `Process exited with code ${code}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

export async function getVideoDurationSeconds(
  videoPath: string,
  shouldCancel?: () => boolean,
  registerChild?: (child: ChildProcess | null) => void,
): Promise<number> {
  const ffprobe = getFfprobePath();
  if (!ffprobe) {
    throw new Error('ffprobe is not available');
  }

  const { stdout } = await runProcess(
    ffprobe,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath],
    registerChild,
    shouldCancel,
  );

  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Unable to read video duration');
  }

  return duration;
}

export function calculateImageCount(durationSeconds: number): number {
  return Math.max(1, Math.ceil(durationSeconds / 60));
}

/**
 * Distribute timestamps evenly across the video, avoiding the very start and end.
 * Uses midpoints of equal segments: (i + 0.5) / n * duration.
 */
export function calculateTimestamps(durationSeconds: number, imageCount: number): number[] {
  if (imageCount <= 0) {
    return [];
  }

  const timestamps: number[] = [];
  const epsilon = Math.min(0.05, durationSeconds / 4);

  for (let i = 0; i < imageCount; i += 1) {
    let timestamp = ((i + 0.5) / imageCount) * durationSeconds;
    timestamp = Math.max(epsilon, Math.min(durationSeconds - epsilon, timestamp));
    if (timestamp >= durationSeconds) {
      timestamp = Math.max(0, durationSeconds - epsilon);
    }
    timestamps.push(timestamp);
  }

  return timestamps;
}

export async function ensureOutputDirectory(folderPath: string): Promise<string> {
  const outputDir = path.join(folderPath, 'Generated Images');
  await fs.mkdir(outputDir, { recursive: true });
  return outputDir;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveUniqueImagePath(
  outputDir: string,
  videoBaseName: string,
  frameIndex: number,
): Promise<string> {
  const padded = String(frameIndex).padStart(2, '0');
  const baseName = `${videoBaseName}_${padded}`;
  let candidate = path.join(outputDir, `${baseName}.jpg`);

  if (!(await fileExists(candidate))) {
    return candidate;
  }

  let suffix = 1;
  while (await fileExists(candidate)) {
    const collision = `${baseName}_${String(suffix).padStart(2, '0')}.jpg`;
    candidate = path.join(outputDir, collision);
    suffix += 1;
  }

  return candidate;
}

export async function extractFramesForVideo(
  videoPath: string,
  outputDir: string,
  callbacks: FrameExtractionCallbacks = {},
): Promise<number> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available');
  }

  const duration = await getVideoDurationSeconds(
    videoPath,
    callbacks.shouldCancel,
    callbacks.registerChild,
  );
  const imageCount = calculateImageCount(duration);
  const timestamps = calculateTimestamps(duration, imageCount);
  const videoBaseName = path.parse(videoPath).name;

  let generated = 0;

  for (let i = 0; i < timestamps.length; i += 1) {
    if (callbacks.shouldCancel?.()) {
      throw new ProcessingCancelledError();
    }

    callbacks.onImageProgress?.(i + 1, imageCount);

    const outputPath = await resolveUniqueImagePath(outputDir, videoBaseName, i + 1);
    const timestamp = timestamps[i];

    await runProcess(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        timestamp.toFixed(3),
        '-i',
        videoPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        '-y',
        outputPath,
      ],
      callbacks.registerChild,
      callbacks.shouldCancel,
    );

    generated += 1;
  }

  return generated;
}

/**
 * Extract a small number of sample frames into an existing directory.
 * Used for temporary Classify Video scoring — caller owns cleanup.
 */
export async function extractSampleFramesToDirectory(
  videoPath: string,
  outputDir: string,
  sampleCount: number,
  callbacks: FrameExtractionCallbacks = {},
): Promise<string[]> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available');
  }

  const duration = await getVideoDurationSeconds(
    videoPath,
    callbacks.shouldCancel,
    callbacks.registerChild,
  );
  const count = Math.max(1, sampleCount);
  const timestamps = calculateTimestamps(duration, count);
  const written: string[] = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    if (callbacks.shouldCancel?.()) {
      throw new ProcessingCancelledError();
    }

    callbacks.onImageProgress?.(i + 1, count);

    const outputPath = path.join(outputDir, `sample_${String(i + 1).padStart(2, '0')}.jpg`);
    await runProcess(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        timestamps[i].toFixed(3),
        '-i',
        videoPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        '-y',
        outputPath,
      ],
      callbacks.registerChild,
      callbacks.shouldCancel,
    );
    written.push(outputPath);
  }

  return written;
}

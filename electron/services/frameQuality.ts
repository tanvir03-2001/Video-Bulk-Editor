import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import { getFfmpegPath } from './ffmpegPaths';
import { ProcessingCancelledError } from './frameGenerator';

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

export interface ExtractSingleFrameOptions {
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
}

/**
 * Extract one JPEG at a timestamp. Prefers I-frames to reduce motion blur;
 * falls back to a plain seek if no keyframe is available at that position.
 */
export async function extractSingleFrameAtTimestamp(
  videoPath: string,
  outputPath: string,
  timestampSeconds: number,
  options: ExtractSingleFrameOptions = {},
): Promise<void> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available');
  }

  const timestamp = timestampSeconds.toFixed(3);
  const baseArgs = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    timestamp,
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    '-y',
    outputPath,
  ];

  const keyframeArgs = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    timestamp,
    '-i',
    videoPath,
    '-vf',
    'select=eq(pict_type\\,I)',
    '-vsync',
    'vfr',
    '-frames:v',
    '1',
    '-q:v',
    '2',
    '-y',
    outputPath,
  ];

  try {
    await runProcess(ffmpeg, keyframeArgs, options.registerChild, options.shouldCancel);
    await fs.access(outputPath);
  } catch {
    await runProcess(ffmpeg, baseArgs, options.registerChild, options.shouldCancel);
  }
}

/**
 * Laplacian variance sharpness score — higher means sharper/clearer frame.
 */
export async function measureSharpness(imagePath: string): Promise<number> {
  const sharp = await import('sharp');
  const { data, info } = await sharp
    .default(imagePath)
    .grayscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  if (pixelCount === 0) {
    return 0;
  }

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    sum += value;
    sumSq += value * value;
  }

  const mean = sum / pixelCount;
  const variance = sumSq / pixelCount - mean * mean;
  return Math.max(0, variance);
}

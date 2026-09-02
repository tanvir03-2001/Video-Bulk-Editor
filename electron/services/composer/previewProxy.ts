import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FAST_EXPORT_MAX_LONG_EDGE, FAST_EXPORT_PRESET, FAST_EXPORT_PROXY_CRF, PROXY_MAX_SECONDS } from './composerConfig';
import { getFfmpegPath, toFfmpegPath } from '../ffmpegPaths';
import { runFfmpegProcess } from '../branding/ffmpegProcess';

export async function generatePreviewProxy(
  videoPath: string,
  outputPath: string,
  shouldCancel?: () => boolean,
  registerChild?: (child: ChildProcess | null) => void,
): Promise<string> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available');
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await runFfmpegProcess(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-t',
      String(PROXY_MAX_SECONDS),
      '-i',
      toFfmpegPath(videoPath),
      '-an',
      '-vf',
      `scale='min(${FAST_EXPORT_MAX_LONG_EDGE},iw)':-2:flags=fast_bilinear`,
      '-c:v',
      'libx264',
      '-preset',
      FAST_EXPORT_PRESET,
      '-crf',
      String(FAST_EXPORT_PROXY_CRF),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-y',
      toFfmpegPath(outputPath),
    ],
    { shouldCancel, registerChild },
  );

  return outputPath;
}

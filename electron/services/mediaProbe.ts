import type { ChildProcess } from 'node:child_process';
import { getFfprobePath } from './ffmpegPaths';
import { runFfmpegProcess } from './branding/ffmpegProcess';

export interface MediaProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
}

interface ProbePayload {
  streams?: ProbeStream[];
  format?: {
    duration?: string;
  };
}

export async function probeMediaFile(
  filePath: string,
  shouldCancel?: () => boolean,
  registerChild?: (child: ChildProcess | null) => void,
): Promise<MediaProbeResult> {
  const ffprobe = getFfprobePath();
  if (!ffprobe) {
    throw new Error('ffprobe is not available');
  }

  const { stdout } = await runFfmpegProcess(
    ffprobe,
    [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,width,height:format=duration',
      '-of',
      'json',
      filePath,
    ],
    { shouldCancel, registerChild },
  );

  const payload = JSON.parse(stdout) as ProbePayload;
  const videoStream = payload.streams?.find((stream) => stream.codec_type === 'video');
  const hasAudio = payload.streams?.some((stream) => stream.codec_type === 'audio') ?? false;
  const width = Number(videoStream?.width ?? 0);
  const height = Number(videoStream?.height ?? 0);
  const durationSeconds = Number(payload.format?.duration ?? 0);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    throw new Error('Unable to read video dimensions');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Unable to read video duration');
  }

  return {
    durationSeconds,
    width,
    height,
    hasAudio,
  };
}

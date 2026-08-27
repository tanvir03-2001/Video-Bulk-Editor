import { spawn, type ChildProcess } from 'node:child_process';
import { ProcessingCancelledError } from '../frameGenerator';

export interface FfmpegRunOptions {
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
  /** Receives `key=value` pairs emitted by ffmpeg's `-progress pipe:1`. */
  onProgressLine?: (key: string, value: string) => void;
}

export interface FfmpegRunResult {
  stdout: string;
  stderr: string;
}

/**
 * Spawn an ffmpeg/ffprobe process with cancellation support and optional
 * streaming progress parsing. Mirrors the spawn conventions used by
 * `frameGenerator.runProcess`, adding stdout line handling for `-progress`.
 */
export function runFfmpegProcess(
  binary: string,
  args: string[],
  options: FfmpegRunOptions = {},
): Promise<FfmpegRunResult> {
  const { shouldCancel, registerChild, onProgressLine } = options;

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
    let pendingLine = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;

      if (!onProgressLine) {
        return;
      }

      pendingLine += text;
      const lines = pendingLine.split(/\r?\n/);
      pendingLine = lines.pop() ?? '';

      for (const line of lines) {
        const separator = line.indexOf('=');
        if (separator > 0) {
          onProgressLine(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
        }
      }
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
        const detail = stderr.trim().split(/\r?\n/).slice(-4).join(' ').trim();
        reject(new Error(detail || `Process exited with code ${code}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

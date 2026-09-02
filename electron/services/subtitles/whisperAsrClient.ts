import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { ProcessingCancelledError } from '../frameGenerator';
import { getModelCacheDir } from '../localRiskModel';

export type WhisperAsrChunk = {
  text?: string;
  timestamp?: [number | null, number | null] | number;
};

type WorkerOutbound =
  | { type: 'status'; id?: number; message: string }
  | { type: 'warmup-done' }
  | { type: 'result'; id: number; text?: string; chunks: WhisperAsrChunk[] }
  | { type: 'error'; id?: number; message: string };

type PendingJob = {
  id: number;
  resolve: (value: { text?: string; chunks: WhisperAsrChunk[] }) => void;
  reject: (error: Error) => void;
  onStatus?: (message: string) => void;
  heartbeat: ReturnType<typeof setInterval> | null;
  startedAt: number;
};

type WarmupState = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
  onStatus?: (message: string) => void;
};

let worker: Worker | null = null;
let nextJobId = 1;
let pending: PendingJob | null = null;
let warmup: WarmupState | null = null;

function resolveWorkerScript(): string {
  // esbuild emits electron/services/subtitles/whisperWorker.ts →
  // dist-electron/services/subtitles/whisperWorker.js (outbase = electron).
  return path.join(__dirname, 'services', 'subtitles', 'whisperWorker.js');
}

function clearHeartbeat(job: PendingJob | null): void {
  if (job?.heartbeat) {
    clearInterval(job.heartbeat);
    job.heartbeat = null;
  }
}

function rejectPending(error: Error): void {
  if (!pending) {
    return;
  }
  const job = pending;
  pending = null;
  clearHeartbeat(job);
  job.reject(error);
}

function settleWarmup(error?: Error): void {
  if (!warmup) {
    return;
  }
  const current = warmup;
  warmup = null;
  if (error) {
    current.reject(error);
    return;
  }
  current.resolve();
}

function attachWorkerHandlers(instance: Worker): void {
  instance.on('message', (message: WorkerOutbound) => {
    if (message.type === 'status') {
      if (pending && (message.id === undefined || message.id === pending.id)) {
        pending.onStatus?.(message.message);
      } else if (!pending && warmup) {
        warmup.onStatus?.(message.message);
      }
      return;
    }

    if (message.type === 'warmup-done') {
      settleWarmup();
      return;
    }

    if (message.type === 'result') {
      if (!pending || pending.id !== message.id) {
        return;
      }
      const job = pending;
      pending = null;
      clearHeartbeat(job);
      job.resolve({ text: message.text, chunks: message.chunks });
      return;
    }

    if (message.type === 'error') {
      if (pending && (message.id === undefined || message.id === pending.id)) {
        rejectPending(new Error(message.message));
        return;
      }
      if (!pending && warmup) {
        settleWarmup(new Error(message.message));
      }
    }
  });

  instance.on('error', (error) => {
    const err = error instanceof Error ? error : new Error(String(error));
    rejectPending(err);
    settleWarmup(err);
    worker = null;
  });

  instance.on('exit', (code) => {
    const err =
      code === 0
        ? new ProcessingCancelledError()
        : new Error(`Whisper worker exited with code ${code}`);
    rejectPending(err);
    settleWarmup(err);
    worker = null;
  });
}

function ensureWorker(): Worker {
  if (worker) {
    return worker;
  }
  const instance = new Worker(resolveWorkerScript(), {
    workerData: { cacheDir: getModelCacheDir() },
  });
  attachWorkerHandlers(instance);
  worker = instance;
  return instance;
}

/**
 * Terminate any in-flight ASR so Cancel returns quickly. The next job
 * recreates the worker (model reloads from disk cache).
 */
export function cancelWhisperTranscription(): void {
  const instance = worker;
  worker = null;
  rejectPending(new ProcessingCancelledError());
  settleWarmup(new ProcessingCancelledError());
  if (instance) {
    void instance.terminate();
  }
}

export async function disposeWhisperAsr(): Promise<void> {
  cancelWhisperTranscription();
}

/**
 * Preload Whisper in the worker during idle time (does not change ASR params).
 */
export function warmupWhisperAsr(onStatus?: (message: string) => void): Promise<void> {
  if (warmup) {
    if (onStatus) {
      warmup.onStatus = onStatus;
    }
    return warmup.promise;
  }

  let resolveFn: () => void = () => undefined;
  let rejectFn: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  warmup = {
    promise,
    resolve: resolveFn,
    reject: rejectFn,
    onStatus,
  };

  try {
    const instance = ensureWorker();
    instance.postMessage({
      type: 'warmup',
      cacheDir: getModelCacheDir(),
    });
  } catch (error) {
    settleWarmup(error instanceof Error ? error : new Error(String(error)));
  }

  return promise.catch((error) => {
    // Allow a fresh warm-up after failure/cancel.
    if (warmup?.promise === promise) {
      warmup = null;
    }
    throw error;
  });
}

export async function runWhisperTranscription(options: {
  wavPath: string;
  onStatus?: (message: string) => void;
  shouldCancel?: () => boolean;
}): Promise<{ text?: string; chunks: WhisperAsrChunk[] }> {
  if (options.shouldCancel?.()) {
    throw new ProcessingCancelledError();
  }

  // Prefer a warm worker; ignore warm-up failures (download can finish on first job).
  await warmupWhisperAsr(options.onStatus).catch(() => undefined);

  if (options.shouldCancel?.()) {
    throw new ProcessingCancelledError();
  }

  const instance = ensureWorker();
  const id = nextJobId;
  nextJobId += 1;

  return new Promise((resolve, reject) => {
    if (pending) {
      reject(new Error('Whisper transcription already in progress'));
      return;
    }

    const job: PendingJob = {
      id,
      resolve,
      reject,
      onStatus: options.onStatus,
      heartbeat: null,
      startedAt: Date.now(),
    };
    pending = job;

    job.heartbeat = setInterval(() => {
      if (options.shouldCancel?.()) {
        cancelWhisperTranscription();
        return;
      }
      const elapsedSec = Math.max(1, Math.round((Date.now() - job.startedAt) / 1000));
      options.onStatus?.(`Transcribing English speech… (${elapsedSec}s)`);
    }, 2000);

    try {
      instance.postMessage({
        type: 'transcribe',
        id,
        wavPath: options.wavPath,
        cacheDir: getModelCacheDir(),
      });
    } catch (error) {
      clearHeartbeat(job);
      pending = null;
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

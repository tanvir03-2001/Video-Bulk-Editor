import { fork, type ChildProcess } from 'node:child_process';
import path from 'node:path';

type ClipOutput = Array<{ label: string; score: number }>;

type WorkerOutbound =
  | { type: 'status'; id?: number; message: string }
  | { type: 'result'; id: number; outputs: ClipOutput }
  | { type: 'error'; id?: number; message: string };

type PendingJob = {
  id: number;
  resolve: (value: ClipOutput) => void;
  reject: (error: Error) => void;
};

let child: ChildProcess | null = null;
let nextJobId = 1;
const pendingJobs = new Map<number, PendingJob>();

function resolveWorkerScript(): string {
  return path.join(__dirname, 'services', 'clipWorker.js');
}

function rejectAllPending(error: Error): void {
  for (const job of pendingJobs.values()) {
    job.reject(error);
  }
  pendingJobs.clear();
}

function attachChildHandlers(instance: ChildProcess): void {
  instance.on('message', (message: WorkerOutbound) => {
    if (message.type === 'status') {
      console.log(`[Image Classifier] ${message.message}`);
      return;
    }

    if (message.type === 'result') {
      const job = pendingJobs.get(message.id);
      if (!job) {
        return;
      }
      pendingJobs.delete(message.id);
      job.resolve(message.outputs);
      return;
    }

    if (message.type === 'error') {
      const err = new Error(message.message);
      if (message.id !== undefined) {
        const job = pendingJobs.get(message.id);
        if (job) {
          pendingJobs.delete(message.id);
          job.reject(err);
        }
        return;
      }
      rejectAllPending(err);
    }
  });

  instance.on('error', (error) => {
    const err = error instanceof Error ? error : new Error(String(error));
    rejectAllPending(err);
    child = null;
  });

  instance.on('exit', (code, signal) => {
    child = null;
    if (code !== 0 && code !== null) {
      rejectAllPending(
        new Error(
          `CLIP worker exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`,
        ),
      );
    }
  });

  instance.stderr?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString().trim();
    if (text) {
      console.error(`[Image Classifier worker] ${text}`);
    }
  });
}

function spawnChild(): ChildProcess {
  const instance = fork(resolveWorkerScript(), [], {
    execPath: process.execPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  attachChildHandlers(instance);
  child = instance;
  return instance;
}

function ensureChild(): ChildProcess {
  if (child && !child.killed) {
    return child;
  }
  child = null;
  return spawnChild();
}

export function disposeClipWorker(): void {
  const instance = child;
  child = null;
  rejectAllPending(new Error('CLIP worker disposed'));
  if (instance && !instance.killed) {
    instance.kill();
  }
}

export async function classifyImageInWorker(options: {
  imagePath: string;
  labels: string[];
  modelId: string;
  cacheDir: string | null;
}): Promise<ClipOutput> {
  const instance = ensureChild();
  const id = nextJobId;
  nextJobId += 1;

  return new Promise((resolve, reject) => {
    pendingJobs.set(id, { id, resolve, reject });
    try {
      instance.send({
        type: 'classify',
        id,
        imagePath: options.imagePath,
        labels: options.labels,
        modelId: options.modelId,
        cacheDir: options.cacheDir,
      });
    } catch (error) {
      pendingJobs.delete(id);
      child = null;
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

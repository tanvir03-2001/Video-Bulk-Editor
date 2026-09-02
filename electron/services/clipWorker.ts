/**
 * Forked child entry for CLIP zero-shot image classification.
 * Runs under ELECTRON_RUN_AS_NODE so onnxruntime stays out of the UI process.
 */
import fs from 'node:fs/promises';

type ZeroShotOutput = Array<{ label: string; score: number }>;

type ZeroShotPipeline = (
  image: string,
  labels: string[],
  options?: { hypothesis_template?: string },
) => Promise<ZeroShotOutput>;

type WorkerInbound =
  | { type: 'classify'; id: number; imagePath: string; labels: string[]; modelId: string; cacheDir: string | null };

type WorkerOutbound =
  | { type: 'status'; id?: number; message: string }
  | { type: 'result'; id: number; outputs: ZeroShotOutput }
  | { type: 'error'; id?: number; message: string };

let pipelinePromise: Promise<ZeroShotPipeline> | null = null;
let loadedModelId: string | null = null;

function post(message: WorkerOutbound): void {
  if (typeof process.send === 'function') {
    process.send(message);
  }
}

/** Use onnxruntime-web (WASM) instead of onnxruntime-node — avoids native crashes on Windows. */
function useWebOnnxBackend(): void {
  if (process.release && typeof process.release === 'object') {
    Object.defineProperty(process.release, 'name', {
      value: 'transformers-wasm',
      configurable: true,
    });
  }
}

function configureTransformersEnv(
  transformers: typeof import('@xenova/transformers'),
  cacheDir: string | null,
): void {
  if (cacheDir) {
    transformers.env.cacheDir = cacheDir;
  }
  transformers.env.allowLocalModels = true;

  const backends = transformers.env.backends as
    | { onnx?: { wasm?: { numThreads?: number } } }
    | undefined;
  if (backends?.onnx?.wasm) {
    backends.onnx.wasm.numThreads = 1;
  }
}

async function loadPipeline(modelId: string, cacheDir: string | null): Promise<ZeroShotPipeline> {
  if (pipelinePromise && loadedModelId === modelId) {
    return pipelinePromise;
  }

  pipelinePromise = null;
  loadedModelId = modelId;

  pipelinePromise = (async () => {
    useWebOnnxBackend();
    const transformers = await import('@xenova/transformers');
    configureTransformersEnv(transformers, cacheDir);

    if (cacheDir) {
      await fs.mkdir(cacheDir, { recursive: true });
    }

    post({ type: 'status', message: `Loading model: ${modelId}` });
    const classifier = (await transformers.pipeline(
      'zero-shot-image-classification',
      modelId,
    )) as ZeroShotPipeline;
    post({ type: 'status', message: 'Model loaded' });
    return classifier;
  })().catch((error) => {
    pipelinePromise = null;
    loadedModelId = null;
    throw error;
  });

  return pipelinePromise;
}

async function handleClassify(message: Extract<WorkerInbound, { type: 'classify' }>): Promise<void> {
  const classifier = await loadPipeline(message.modelId, message.cacheDir);
  post({ type: 'status', id: message.id, message: 'Running classification…' });
  const outputs = await classifier(message.imagePath, message.labels);
  post({ type: 'result', id: message.id, outputs });
}

if (typeof process.send !== 'function') {
  throw new Error('clipWorker must run as a forked child process');
}

let messageChain: Promise<void> = Promise.resolve();

process.on('message', (raw: WorkerInbound) => {
  messageChain = messageChain
    .then(async () => {
      if (raw.type === 'classify') {
        await handleClassify(raw);
      }
    })
    .catch((error) => {
      const errMessage = error instanceof Error ? error.message : String(error);
      post({
        type: 'error',
        id: raw.type === 'classify' ? raw.id : undefined,
        message: errMessage,
      });
    });
});

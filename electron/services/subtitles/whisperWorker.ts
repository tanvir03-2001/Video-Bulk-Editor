/**
 * Worker-thread entry for Whisper ASR. Keep inference off Electron's main
 * process so the UI / IPC event loop stays responsive.
 *
 * Post-processing (refineWordTimings, ASS layout) stays in the main process.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';

const WHISPER_MODEL_ID = 'Xenova/whisper-small.en';

type AsrChunk = {
  text?: string;
  timestamp?: [number | null, number | null] | number;
};

type AsrOutput = {
  text?: string;
  chunks?: AsrChunk[];
};

type AsrPipeline = (
  audio: Float32Array | string,
  options?: Record<string, unknown>,
) => Promise<AsrOutput>;

type WorkerInbound =
  | { type: 'warmup'; cacheDir: string | null }
  | { type: 'transcribe'; id: number; wavPath: string; cacheDir: string | null };

type WorkerOutbound =
  | { type: 'status'; id?: number; message: string }
  | { type: 'warmup-done' }
  | { type: 'result'; id: number; text?: string; chunks: AsrChunk[] }
  | { type: 'error'; id?: number; message: string };

let asrPromise: Promise<AsrPipeline> | null = null;

function post(message: WorkerOutbound): void {
  parentPort?.postMessage(message);
}

async function isWhisperCached(cacheDir: string): Promise<boolean> {
  const candidates = [
    path.join(cacheDir, 'Xenova', 'whisper-small.en'),
    path.join(cacheDir, 'models', 'Xenova', 'whisper-small.en'),
  ];
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return true;
      }
    } catch {
      // keep looking
    }
  }
  return false;
}

async function loadAsrPipeline(
  cacheDir: string | null,
  onStatus?: (message: string) => void,
): Promise<AsrPipeline> {
  const transformers = await import('@xenova/transformers');

  if (cacheDir) {
    transformers.env.cacheDir = cacheDir;
    await fs.mkdir(cacheDir, { recursive: true });
  }
  transformers.env.allowLocalModels = true;

  const cached = cacheDir ? await isWhisperCached(cacheDir) : false;
  onStatus?.(
    cached ? 'Loading Whisper from cache…' : 'Downloading Whisper model (one-time)…',
  );

  const pipeline = (await transformers.pipeline(
    'automatic-speech-recognition',
    WHISPER_MODEL_ID,
  )) as AsrPipeline;
  onStatus?.(cached ? 'Whisper model ready (cached)' : 'Whisper model ready');
  return pipeline;
}

function getAsrPipeline(
  cacheDir: string | null,
  onStatus?: (message: string) => void,
): Promise<AsrPipeline> {
  if (!asrPromise) {
    asrPromise = loadAsrPipeline(cacheDir, onStatus).catch((error) => {
      asrPromise = null;
      throw error;
    });
  } else if (onStatus) {
    onStatus('Loading Whisper model…');
  }
  return asrPromise;
}

async function readWavAsFloat32(wavPath: string): Promise<Float32Array> {
  const buffer = await fs.readFile(wavPath);
  const dataOffset = findWavDataOffset(buffer);
  const sampleCount = Math.floor((buffer.length - dataOffset) / 2);
  const samples = new Float32Array(Math.max(0, sampleCount));
  for (let index = 0; index < samples.length; index += 1) {
    const int16 = buffer.readInt16LE(dataOffset + index * 2);
    samples[index] = int16 / 32768;
  }
  return samples;
}

/**
 * Locate PCM payload after RIFF chunks. Assuming a fixed 44-byte header
 * mis-parses ffmpeg WAVs with larger fmt chunks and skews late timestamps.
 */
function findWavDataOffset(buffer: Buffer): number {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return 0;
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'data') {
      return offset + 8;
    }
    // Chunk sizes are even-padded.
    offset += 8 + size + (size % 2);
  }
  return 44;
}

async function handleWarmup(cacheDir: string | null): Promise<void> {
  await getAsrPipeline(cacheDir, (message) => post({ type: 'status', message }));
  post({ type: 'warmup-done' });
}

async function handleTranscribe(message: Extract<WorkerInbound, { type: 'transcribe' }>): Promise<void> {
  const asr = await getAsrPipeline(message.cacheDir, (status) =>
    post({ type: 'status', id: message.id, message: status }),
  );

  post({ type: 'status', id: message.id, message: 'Transcribing English speech…' });
  const audio = await readWavAsFloat32(message.wavPath);
  const durationSeconds = audio.length / 16000;
  // Chunk boundaries cause progressive timestamp drift (start OK, end wrong).
  // Skip chunking for typical short-form / mid-length clips; otherwise use
  // larger chunks and disable previous-text conditioning to stop cascade errors.
  const asrOptions: Record<string, unknown> = {
    sampling_rate: 16000,
    return_timestamps: 'word',
    condition_on_previous_text: false,
  };
  if (durationSeconds > 90) {
    asrOptions.chunk_length_s = 30;
    asrOptions.stride_length_s = 5;
  }

  const result = await asr(audio, asrOptions);

  post({
    type: 'result',
    id: message.id,
    text: result.text,
    chunks: Array.isArray(result.chunks) ? result.chunks : [],
  });
}

if (!parentPort) {
  throw new Error('whisperWorker must run as a worker_threads Worker');
}

// Optional cacheDir from workerData for early env setup (ignored if null).
void workerData;

let messageChain: Promise<void> = Promise.resolve();

parentPort.on('message', (raw: WorkerInbound) => {
  messageChain = messageChain
    .then(async () => {
      if (raw.type === 'warmup') {
        await handleWarmup(raw.cacheDir);
        return;
      }
      if (raw.type === 'transcribe') {
        await handleTranscribe(raw);
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      post({
        type: 'error',
        id: raw.type === 'transcribe' ? raw.id : undefined,
        message,
      });
    });
});

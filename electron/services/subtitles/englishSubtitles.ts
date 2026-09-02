import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getFfmpegPath, toFfmpegPath } from '../ffmpegPaths';
import { ProcessingCancelledError } from '../frameGenerator';
import { runFfmpegProcess } from '../branding/ffmpegProcess';
import { getModelCacheDir } from '../localRiskModel';

export interface SubtitleWord {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface SubtitleCue {
  words: SubtitleWord[];
  startSeconds: number;
  endSeconds: number;
}

const WHISPER_MODEL_ID = 'Xenova/whisper-small.en';
const WORDS_PER_CUE = 3;
/** Whisper often stretches the final token end; keep on-screen holds realistic. */
const MAX_WORD_HOLD_SECONDS = 0.85;
const MIN_WORD_HOLD_SECONDS = 0.12;

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

let asrPromise: Promise<AsrPipeline> | null = null;

async function isWhisperCached(cacheDir: string): Promise<boolean> {
  // @xenova/transformers stores Hub models under cacheDir/models/<org>/<name>
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

async function loadAsrPipeline(onStatus?: (message: string) => void): Promise<AsrPipeline> {
  const cacheDir = getModelCacheDir();
  const transformers = await import('@xenova/transformers');

  if (cacheDir) {
    transformers.env.cacheDir = cacheDir;
    await fs.mkdir(cacheDir, { recursive: true });
  }
  // Prefer local cache after first download; allow offline reuse.
  transformers.env.allowLocalModels = true;

  const cached = cacheDir ? await isWhisperCached(cacheDir) : false;
  onStatus?.(
    cached
      ? 'Loading Whisper from cache…'
      : 'Downloading Whisper model (one-time)…',
  );

  const pipeline = (await transformers.pipeline(
    'automatic-speech-recognition',
    WHISPER_MODEL_ID,
  )) as AsrPipeline;
  onStatus?.(cached ? 'Whisper model ready (cached)' : 'Whisper model ready');
  return pipeline;
}

function getAsrPipeline(onStatus?: (message: string) => void): Promise<AsrPipeline> {
  if (!asrPromise) {
    asrPromise = loadAsrPipeline(onStatus).catch((error) => {
      asrPromise = null;
      throw error;
    });
  }
  return asrPipelineWithStatus(asrPromise, onStatus);
}

async function asrPipelineWithStatus(
  promise: Promise<AsrPipeline>,
  onStatus?: (message: string) => void,
): Promise<AsrPipeline> {
  if (onStatus) {
    onStatus('Loading Whisper model…');
  }
  return promise;
}

/**
 * Extract 16 kHz mono PCM WAV for Whisper.
 */
export async function extractAudioWav(options: {
  inputPath: string;
  outputPath: string;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
}): Promise<void> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available');
  }

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await runFfmpegProcess(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-i',
      toFfmpegPath(options.inputPath),
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      toFfmpegPath(options.outputPath),
    ],
    {
      shouldCancel: options.shouldCancel,
      registerChild: options.registerChild,
    },
  );
}

function normalizeWords(chunks: AsrChunk[]): SubtitleWord[] {
  const words: SubtitleWord[] = [];
  for (const chunk of chunks) {
    const text = (chunk.text ?? '').trim();
    if (!text) {
      continue;
    }
    let start = 0;
    let end = 0;
    if (Array.isArray(chunk.timestamp)) {
      start = Number(chunk.timestamp[0] ?? 0);
      end = Number(chunk.timestamp[1] ?? start + 0.35);
    } else if (typeof chunk.timestamp === 'number') {
      start = chunk.timestamp;
      end = start + 0.35;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      continue;
    }
    // Whisper may return multi-word chunks; split evenly across the span.
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      words.push({ text, startSeconds: start, endSeconds: end });
      continue;
    }
    const span = (end - start) / parts.length;
    parts.forEach((part, index) => {
      words.push({
        text: part,
        startSeconds: start + index * span,
        endSeconds: start + (index + 1) * span,
      });
    });
  }
  return refineWordTimings(words);
}

/**
 * Tighten Whisper word ends so captions stay locked to speech through the
 * ending — the model often assigns an inflated end time to the last tokens.
 */
export function refineWordTimings(words: SubtitleWord[]): SubtitleWord[] {
  if (words.length === 0) {
    return words;
  }

  const sorted = [...words].sort((a, b) => a.startSeconds - b.startSeconds);
  const refined: SubtitleWord[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    let start = Math.max(0, current.startSeconds);

    // Keep monotonic starts if Whisper overlaps words.
    if (refined.length > 0) {
      start = Math.max(start, refined[refined.length - 1].endSeconds);
    }

    let end: number;
    if (next && Number.isFinite(next.startSeconds) && next.startSeconds > start) {
      // Snap to next word start — avoids Whisper's stretched token ends.
      end = next.startSeconds;
    } else {
      end = Math.min(
        Number.isFinite(current.endSeconds) ? current.endSeconds : start + MAX_WORD_HOLD_SECONDS,
        start + MAX_WORD_HOLD_SECONDS,
      );
    }

    end = Math.max(start + MIN_WORD_HOLD_SECONDS, end);

    refined.push({
      text: current.text,
      startSeconds: start,
      endSeconds: end,
    });
  }

  return refined;
}

export function groupWordsIntoCues(words: SubtitleWord[], wordsPerCue = WORDS_PER_CUE): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (let index = 0; index < words.length; index += wordsPerCue) {
    const slice = words.slice(index, index + wordsPerCue);
    if (slice.length === 0) {
      continue;
    }
    cues.push({
      words: slice,
      startSeconds: slice[0].startSeconds,
      endSeconds: slice[slice.length - 1].endSeconds,
    });
  }
  return cues;
}

function formatAssTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const centis = Math.floor((clamped - Math.floor(clamped)) * 100);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

function escapeAssText(text: string): string {
  return text.replace(/[{}\\]/g, '');
}

/**
 * Modern Reels-style ASS: large center captions, active word highlighted.
 * Highlight windows snap to the next word start so endings stay tight.
 */
export function buildReelsAss(cues: SubtitleCue[]): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Reels,Arial Black,72,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,0,2,40,40,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const flatWords = cues.flatMap((cue) => cue.words);
  const events = cues
    .map((cue) =>
      cue.words
        .map((word, activeIndex) => {
          const rendered = cue.words
            .map((candidate, index) => {
              const escaped = escapeAssText(candidate.text);
              return index === activeIndex
                ? `{\\c&H00FFFF&\\b1}${escaped}{\\c&HFFFFFF&\\b0}`
                : escaped;
            })
            .join(' ');

          const globalIndex = flatWords.findIndex(
            (candidate) =>
              candidate === word ||
              (candidate.startSeconds === word.startSeconds &&
                candidate.endSeconds === word.endSeconds &&
                candidate.text === word.text),
          );
          const nextWord =
            globalIndex >= 0 && globalIndex < flatWords.length - 1
              ? flatWords[globalIndex + 1]
              : undefined;
          const highlightEnd = nextWord
            ? Math.max(word.startSeconds + MIN_WORD_HOLD_SECONDS, nextWord.startSeconds)
            : Math.min(word.endSeconds, word.startSeconds + MAX_WORD_HOLD_SECONDS);
          const end = Math.max(word.startSeconds + MIN_WORD_HOLD_SECONDS, highlightEnd);
          return `Dialogue: 0,${formatAssTime(word.startSeconds)},${formatAssTime(end)},Reels,,0,0,0,,${rendered}`;
        })
        .join('\n'),
    )
    .join('\n');

  return `${header}${events}\n`;
}

async function readWavAsFloat32(wavPath: string): Promise<Float32Array> {
  const buffer = await fs.readFile(wavPath);
  // Skip 44-byte PCM WAV header when present.
  const dataOffset = buffer.length > 44 && buffer.toString('ascii', 0, 4) === 'RIFF' ? 44 : 0;
  const sampleCount = Math.floor((buffer.length - dataOffset) / 2);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const int16 = buffer.readInt16LE(dataOffset + index * 2);
    samples[index] = int16 / 32768;
  }
  return samples;
}

export async function transcribeEnglish(options: {
  wavPath: string;
  onStatus?: (message: string) => void;
  shouldCancel?: () => boolean;
}): Promise<SubtitleCue[]> {
  if (options.shouldCancel?.()) {
    throw new ProcessingCancelledError();
  }

  const asr = await getAsrPipeline(options.onStatus);
  if (options.shouldCancel?.()) {
    throw new ProcessingCancelledError();
  }

  options.onStatus?.('Transcribing English speech…');
  const audio = await readWavAsFloat32(options.wavPath);
  const result = await asr(audio, {
    // Required so word timestamps match real wall-clock seconds for 16 kHz PCM.
    sampling_rate: 16000,
    return_timestamps: 'word',
    // Shorter chunks reduce end-of-audio timestamp drift on longer tracks.
    chunk_length_s: 20,
    stride_length_s: 4,
  });

  const chunks = Array.isArray(result.chunks) ? result.chunks : [];
  if (chunks.length === 0 && result.text?.trim()) {
    // Fallback: single cue covering a guessed duration.
    const words = refineWordTimings(
      result.text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((text, index) => ({
          text,
          startSeconds: index * 0.35,
          endSeconds: (index + 1) * 0.35,
        })),
    );
    return groupWordsIntoCues(words);
  }

  return groupWordsIntoCues(normalizeWords(chunks));
}

export async function generateEnglishSubtitlesAss(options: {
  mediaPath: string;
  onStatus?: (message: string) => void;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
  /** Shift all cue times forward (e.g. soundtrack adelay on combiner timeline). */
  timelineOffsetSeconds?: number;
}): Promise<string | null> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfg-subs-'));
  const wavPath = path.join(tempDir, 'audio.wav');
  const assPath = path.join(tempDir, 'reels.ass');
  const timelineOffsetSeconds = options.timelineOffsetSeconds ?? 0;

  try {
    options.onStatus?.('Extracting audio');
    await extractAudioWav({
      inputPath: options.mediaPath,
      outputPath: wavPath,
      shouldCancel: options.shouldCancel,
      registerChild: options.registerChild,
    });

    const cues = await transcribeEnglish({
      wavPath,
      onStatus: options.onStatus,
      shouldCancel: options.shouldCancel,
    });

    if (cues.length === 0) {
      options.onStatus?.('No English speech detected');
      return null;
    }

    const shiftedCues =
      timelineOffsetSeconds > 0
        ? cues.map((cue) => ({
            ...cue,
            startSeconds: cue.startSeconds + timelineOffsetSeconds,
            endSeconds: cue.endSeconds + timelineOffsetSeconds,
            words: cue.words.map((word) => ({
              ...word,
              startSeconds: word.startSeconds + timelineOffsetSeconds,
              endSeconds: word.endSeconds + timelineOffsetSeconds,
            })),
          }))
        : cues;

    options.onStatus?.('Building reels captions');
    const ass = buildReelsAss(shiftedCues);
    await fs.writeFile(assPath, ass, 'utf8');

    // Keep ASS outside the temp cleanup by copying to a sibling that caller owns.
    const persistent = path.join(os.tmpdir(), `vfg-reels-${Date.now()}.ass`);
    await fs.copyFile(assPath, persistent);
    return persistent;
  } catch (error) {
    if (error instanceof ProcessingCancelledError) {
      throw error;
    }
    // Missing audio / empty speech should not fail the whole brand/export job.
    const message = error instanceof Error ? error.message : String(error);
    options.onStatus?.(`Subtitles skipped: ${message}`);
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function escapeAssFilterPath(filePath: string): string {
  // FFmpeg ass filter path escaping for Windows.
  return toFfmpegPath(filePath)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

/**
 * Burn an ASS file onto a video, writing a new output file.
 */
export async function burnSubtitlesAss(options: {
  videoPath: string;
  assPath: string;
  outputPath: string;
  shouldCancel?: () => boolean;
  registerChild?: (child: ChildProcess | null) => void;
  onPercent?: (percent: number) => void;
}): Promise<void> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available');
  }

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  const assFilter = `ass='${escapeAssFilterPath(options.assPath)}'`;

  await runFfmpegProcess(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-i',
      toFfmpegPath(options.videoPath),
      '-vf',
      assFilter,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-c:a',
      'copy',
      '-movflags',
      '+faststart',
      '-progress',
      'pipe:1',
      '-nostats',
      toFfmpegPath(options.outputPath),
    ],
    {
      shouldCancel: options.shouldCancel,
      registerChild: options.registerChild,
      onProgressLine: (key, value) => {
        if (key !== 'out_time_ms' || !options.onPercent) {
          return;
        }
        const microseconds = Number(value);
        if (!Number.isFinite(microseconds) || microseconds < 0) {
          return;
        }
        // Without known duration, gently climb toward 95.
        options.onPercent(Math.min(95, microseconds / 1_000_000 / 60 * 100));
      },
    },
  );
  options.onPercent?.(100);
}

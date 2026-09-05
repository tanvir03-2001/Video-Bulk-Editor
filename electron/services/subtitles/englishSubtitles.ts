import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  BRANDING_LIMITS,
  DEFAULT_BRANDING_SUBTITLES,
  DEFAULT_SUBTITLE_DESIGN_ID,
  DEFAULT_SUBTITLE_FOCUS_COLOR,
  SUBTITLE_PLAY_RES,
  type BrandingSubtitlesConfig,
  type SubtitleDesignId,
} from '../../../shared/branding';
import { getFfmpegPath, toFfmpegPath } from '../ffmpegPaths';
import { getVideoDurationSeconds, ProcessingCancelledError } from '../frameGenerator';
import { runFfmpegProcess } from '../branding/ffmpegProcess';
import {
  runWhisperTranscription,
  type WhisperAsrChunk,
} from './whisperAsrClient';

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

const WORDS_PER_CUE = 3;
const MIN_WORD_HOLD_SECONDS = 0.12;
/**
 * Last spoken word: hold longer so the final seconds of the video are not blank
 * after Whisper's short end timestamp.
 */
const LAST_WORD_HOLD_SECONDS = 3.0;
/** If the last word starts inside this window before EOF, pin its end to media EOF. */
const FINAL_CAPTION_FILL_SECONDS = 4.0;
/** Drop/clamp cues that would land at or past media EOF (avoids invisible last lines). */
const CUE_END_EPSILON_SECONDS = 0.02;

type AsrChunk = WhisperAsrChunk;

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
      // Last word: allow a longer hold so trailing seconds keep a caption on screen.
      const whisperEnd = Number.isFinite(current.endSeconds)
        ? current.endSeconds
        : start + LAST_WORD_HOLD_SECONDS;
      end = Math.min(Math.max(whisperEnd, start + MIN_WORD_HOLD_SECONDS), start + LAST_WORD_HOLD_SECONDS);
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

/** CSS #RRGGBB → ASS &HAABBGGRR (opaque). */
export function hexToAssColour(hex: string, fallback = DEFAULT_SUBTITLE_FOCUS_COLOR): string {
  const candidate = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())?.[1]
    ?? /^#([0-9a-fA-F]{6})$/.exec(fallback.trim())?.[1]
    ?? '00FFFF';
  const r = candidate.slice(0, 2);
  const g = candidate.slice(2, 4);
  const b = candidate.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function resolveFocusAssColour(position?: Partial<BrandingSubtitlesConfig>): string {
  const hex =
    typeof position?.focusColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(position.focusColor.trim())
      ? position.focusColor.trim()
      : DEFAULT_BRANDING_SUBTITLES.focusColor;
  return hexToAssColour(hex);
}

export function resolveSubtitlePlayPosition(position?: Partial<BrandingSubtitlesConfig>): {
  x: number;
  y: number;
} {
  const limits = BRANDING_LIMITS.subtitlePositionPercent;
  const xPercent = Number.isFinite(position?.xPercent)
    ? Math.min(limits.max, Math.max(limits.min, Number(position?.xPercent)))
    : DEFAULT_BRANDING_SUBTITLES.xPercent;
  const yPercent = Number.isFinite(position?.yPercent)
    ? Math.min(limits.max, Math.max(limits.min, Number(position?.yPercent)))
    : DEFAULT_BRANDING_SUBTITLES.yPercent;
  return {
    x: Math.round((SUBTITLE_PLAY_RES.x * xPercent) / 100),
    y: Math.round((SUBTITLE_PLAY_RES.y * yPercent) / 100),
  };
}

/**
 * Modern Reels-style ASS: large center captions, active word highlighted.
 * Highlight windows snap to the next word start so endings stay tight.
 * Position uses {\pos(x,y)} so callers can move captions without changing timing.
 */
export function buildReelsAss(
  cues: SubtitleCue[],
  position?: Partial<BrandingSubtitlesConfig>,
  maxEndSeconds?: number,
): string {
  const { x: posX, y: posY } = resolveSubtitlePlayPosition(position);
  const posTag = `{\\pos(${posX},${posY})}`;
  const focusAss = resolveFocusAssColour(position);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${SUBTITLE_PLAY_RES.x}
PlayResY: ${SUBTITLE_PLAY_RES.y}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Reels,Arial Black,72,&H00FFFFFF,${focusAss},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,0,5,40,40,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = buildKaraokeDialogueEvents(
    cues,
    'Reels',
    posTag,
    (escaped, isActive) => {
      const text = escaped.toUpperCase();
      return isActive
        ? `{\\c${focusAss}\\b1}${text}{\\c&H00FFFFFF&\\b0}`
        : text;
    },
    maxEndSeconds,
  );

  return `${header}${events}\n`;
}

/**
 * Cinematic kinetic ASS: heavy condensed type, focus-coloured active keyword
 * with scale pop (overshoot via \\t), white surrounding words, tight spacing.
 */
export function buildCinematicKineticAss(
  cues: SubtitleCue[],
  position?: Partial<BrandingSubtitlesConfig>,
  maxEndSeconds?: number,
): string {
  const { x: posX, y: posY } = resolveSubtitlePlayPosition(position);
  const posTag = `{\\pos(${posX},${posY})}`;
  const focusAss = resolveFocusAssColour(position);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${SUBTITLE_PLAY_RES.x}
PlayResY: ${SUBTITLE_PLAY_RES.y}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kinetic,Impact,78,&H00FFFFFF,${focusAss},&H00000000,&H80000000,-1,0,0,0,100,100,-2,0,1,5,1,5,40,40,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = buildKaraokeDialogueEvents(
    cues,
    'Kinetic',
    posTag,
    (escaped, isActive) => {
      const text = escaped.toUpperCase();
      return isActive
        ? `{\\fscx72\\fscy72\\c${focusAss}\\b1\\t(0,110,\\fscx132\\fscy132)\\t(110,220,\\fscx116\\fscy116)}${text}{\\fscx100\\fscy100\\c&H00FFFFFF&\\b0}`
        : text;
    },
    maxEndSeconds,
  );

  return `${header}${events}\n`;
}

export function buildSubtitlesAss(
  cues: SubtitleCue[],
  position?: Partial<BrandingSubtitlesConfig>,
  maxEndSeconds?: number,
): string {
  const designId: SubtitleDesignId =
    position?.designId === 'cinematic-kinetic' ? 'cinematic-kinetic' : DEFAULT_SUBTITLE_DESIGN_ID;
  return designId === 'cinematic-kinetic'
    ? buildCinematicKineticAss(cues, position, maxEndSeconds)
    : buildReelsAss(cues, position, maxEndSeconds);
}

/**
 * Drop cues that start at/after media EOF and clamp word ends so last captions stay visible.
 */
export function clampCuesToMediaDuration(
  cues: SubtitleCue[],
  mediaDurationSeconds: number,
  epsilonSeconds = CUE_END_EPSILON_SECONDS,
): SubtitleCue[] {
  const maxEnd = Math.max(0, mediaDurationSeconds - epsilonSeconds);
  if (!(maxEnd > 0)) {
    return [];
  }

  const clamped: SubtitleCue[] = [];
  for (const cue of cues) {
    if (cue.startSeconds >= maxEnd) {
      continue;
    }
    const words = cue.words
      .filter((word) => word.startSeconds < maxEnd)
      .map((word) => {
        const startSeconds = Math.max(0, Math.min(word.startSeconds, maxEnd));
        const endSeconds = Math.max(
          startSeconds + MIN_WORD_HOLD_SECONDS,
          Math.min(word.endSeconds, maxEnd),
        );
        return {
          ...word,
          startSeconds,
          endSeconds: Math.min(endSeconds, maxEnd),
        };
      })
      .filter((word) => word.startSeconds < maxEnd);

    if (words.length === 0) {
      continue;
    }

    clamped.push({
      words,
      startSeconds: words[0].startSeconds,
      endSeconds: Math.min(Math.max(cue.endSeconds, words[words.length - 1].endSeconds), maxEnd),
    });
  }
  return clamped;
}

function resolveWordHighlightEnd(
  word: SubtitleWord,
  flatWords: SubtitleWord[],
  maxEndSeconds?: number,
): number {
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
  const isLastWord = !nextWord;
  let end: number;
  if (!isLastWord) {
    const highlightEnd = Math.max(word.startSeconds + MIN_WORD_HOLD_SECONDS, nextWord.startSeconds);
    end = Math.max(word.startSeconds + MIN_WORD_HOLD_SECONDS, highlightEnd);
  } else {
    // Keep the final karaoke event on screen through the end of speech / near EOF.
    const naturalEnd = Number.isFinite(word.endSeconds)
      ? word.endSeconds
      : word.startSeconds + LAST_WORD_HOLD_SECONDS;
    end = Math.max(
      word.startSeconds + MIN_WORD_HOLD_SECONDS,
      Math.min(naturalEnd, word.startSeconds + LAST_WORD_HOLD_SECONDS),
    );
    if (typeof maxEndSeconds === 'number' && Number.isFinite(maxEndSeconds) && maxEndSeconds > word.startSeconds) {
      const holdTo = Math.min(maxEndSeconds, word.startSeconds + LAST_WORD_HOLD_SECONDS);
      end = Math.max(end, holdTo);
      if (word.startSeconds >= maxEndSeconds - FINAL_CAPTION_FILL_SECONDS) {
        end = maxEndSeconds;
      }
    }
  }
  if (typeof maxEndSeconds === 'number' && Number.isFinite(maxEndSeconds) && maxEndSeconds > 0) {
    end = Math.min(end, maxEndSeconds);
  }
  return end;
}

function buildKaraokeDialogueEvents(
  cues: SubtitleCue[],
  styleName: string,
  posTag: string,
  renderWord: (escaped: string, isActive: boolean) => string,
  maxEndSeconds?: number,
): string {
  const flatWords = cues.flatMap((cue) => cue.words);
  return cues
    .map((cue) =>
      cue.words
        .map((word, activeIndex) => {
          if (
            typeof maxEndSeconds === 'number' &&
            Number.isFinite(maxEndSeconds) &&
            word.startSeconds >= maxEndSeconds
          ) {
            return null;
          }
          const rendered = cue.words
            .map((candidate, index) =>
              renderWord(escapeAssText(candidate.text), index === activeIndex),
            )
            .join(' ');
          const end = resolveWordHighlightEnd(word, flatWords, maxEndSeconds);
          if (end <= word.startSeconds) {
            return null;
          }
          return `Dialogue: 0,${formatAssTime(word.startSeconds)},${formatAssTime(end)},${styleName},,0,0,0,,${posTag}${rendered}`;
        })
        .filter((line): line is string => Boolean(line))
        .join('\n'),
    )
    .filter((block) => block.length > 0)
    .join('\n');
}

export async function transcribeEnglish(options: {
  wavPath: string;
  onStatus?: (message: string) => void;
  shouldCancel?: () => boolean;
}): Promise<SubtitleCue[]> {
  if (options.shouldCancel?.()) {
    throw new ProcessingCancelledError();
  }

  // ASR + WAV decode run in a worker thread so Electron main/UI stay responsive.
  // Timing refinement and ASS layout stay here unchanged.
  const result = await runWhisperTranscription({
    wavPath: options.wavPath,
    onStatus: options.onStatus,
    shouldCancel: options.shouldCancel,
  });

  if (options.shouldCancel?.()) {
    throw new ProcessingCancelledError();
  }

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
  /**
   * When set, probe this file for EOF clamping (e.g. burn-target video) instead
   * of mediaPath (which may be a shorter soundtrack file).
   */
  clampToMediaPath?: string;
  /** Caption placement; defaults match legacy bottom-center MarginV 220. */
  position?: Partial<BrandingSubtitlesConfig>;
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

    const durationProbePath = options.clampToMediaPath ?? options.mediaPath;
    let mediaDurationSeconds: number | null = null;
    try {
      mediaDurationSeconds = await getVideoDurationSeconds(
        durationProbePath,
        options.shouldCancel,
        options.registerChild,
      );
    } catch {
      // Duration probe is best-effort; still build captions without EOF clamp.
    }

    const maxEndSeconds =
      mediaDurationSeconds != null && mediaDurationSeconds > 0
        ? Math.max(0, mediaDurationSeconds - CUE_END_EPSILON_SECONDS)
        : undefined;

    const timedCues =
      maxEndSeconds != null
        ? clampCuesToMediaDuration(shiftedCues, mediaDurationSeconds!, CUE_END_EPSILON_SECONDS)
        : shiftedCues;

    if (timedCues.length === 0) {
      options.onStatus?.('No English speech detected');
      return null;
    }

    options.onStatus?.('Building captions');
    const ass = buildSubtitlesAss(timedCues, options.position, maxEndSeconds);
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

/**
 * Central configuration for local image risk classification.
 * Thresholds and labels are kept here — do not scatter magic numbers.
 */

export const SAFE_IMAGES_DIR = 'safe-images';
export const FLAGGED_IMAGES_DIR = 'flagged-images';
export const SAFE_VIDEOS_DIR = 'safe-videos';
export const FLAGGED_VIDEOS_DIR = 'flagged-videos';
export const CLASSIFICATION_REPORT_FILE = 'classification-report.json';
export const VIDEO_CLASSIFICATION_REPORT_FILE = 'video-classification-report.json';

/** @deprecated Prefer calculateVideoSampleCount(duration) for thorough Classify Video. */
export const VIDEO_SAMPLE_FRAME_COUNT = 3;

/** Default Allow % for Classify Split (matches CLASSIFICATION_THRESHOLDS 0.25). */
export const DEFAULT_ALLOW_PERCENT = 25;

/** Max initial probe frames per video in Video → Frames adaptive flow. */
export const VIDEO_PROBE_FRAME_MAX = 3;

/** Max extra timestamp retries when initial probe frames are all flagged. */
export const VIDEO_SAFE_RETRY_MAX = 5;

export const DEFAULT_MODEL_ID = 'Xenova/clip-vit-base-patch32';

/**
 * Score thresholds per risk category.
 * CLIP zero-shot returns a softmax over all candidate labels (risk + safe contrast),
 * so defaults are lower than a binary 0–1 detector. Override via env if needed.
 */
export const CLASSIFICATION_THRESHOLDS = {
  nudity: 0.25,
  sexualContent: 0.25,
  violence: 0.25,
  gore: 0.25,
  weapon: 0.25,
  drugs: 0.25,
  hateSymbol: 0.25,
  logo: 0.25,
  watermark: 0.25,
  recognizableCharacter: 0.25,
} as const;

export type ThresholdKey = keyof typeof CLASSIFICATION_THRESHOLDS;

/**
 * Candidate text labels for CLIP zero-shot classification.
 * Each entry maps a natural-language prompt to one or more reason codes
 * and the threshold key used for that category.
 */
export interface RiskLabelDefinition {
  /** Prompt shown to CLIP */
  label: string;
  /** Reason codes recorded when this label exceeds its threshold */
  reasons: string[];
  /** Key into CLASSIFICATION_THRESHOLDS */
  thresholdKey: ThresholdKey;
  /** When true, also add potential_copyright_risk / copyright_risk_indicator */
  copyrightRiskIndicator?: boolean;
}

export const RISK_LABEL_DEFINITIONS: RiskLabelDefinition[] = [
  {
    label: 'nudity or exposed intimate body parts',
    reasons: ['nudity'],
    thresholdKey: 'nudity',
  },
  {
    label: 'explicit sexual content or pornography',
    reasons: ['sexual_content'],
    thresholdKey: 'sexualContent',
  },
  {
    label: 'graphic violence or physical assault',
    reasons: ['violence'],
    thresholdKey: 'violence',
  },
  {
    label: 'blood gore or severe graphic injuries',
    reasons: ['blood', 'gore'],
    thresholdKey: 'gore',
  },
  {
    label: 'guns knives or dangerous weapons',
    reasons: ['weapon'],
    thresholdKey: 'weapon',
  },
  {
    label: 'illegal drugs or drug paraphernalia',
    reasons: ['drug'],
    thresholdKey: 'drugs',
  },
  {
    label: 'hate symbols or extremist imagery',
    reasons: ['hate_symbol'],
    thresholdKey: 'hateSymbol',
  },
  {
    label: 'clearly visible brand logos or trademarks',
    reasons: ['logo'],
    thresholdKey: 'logo',
    copyrightRiskIndicator: true,
  },
  {
    label: 'platform watermarks or overlay watermarks',
    reasons: ['watermark'],
    thresholdKey: 'watermark',
    copyrightRiskIndicator: true,
  },
  {
    label: 'famous fictional movie game or cartoon characters',
    reasons: ['recognizable_character'],
    thresholdKey: 'recognizableCharacter',
    copyrightRiskIndicator: true,
  },
];

/** Neutral contrast label so CLIP scores are not forced onto risk-only classes. */
export const SAFE_CONTRAST_LABEL = 'a normal safe everyday photograph with no risky content';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parsePositiveIntEnv(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultValue;
  }
  return parsed;
}

function parseThresholdOverrides(): Partial<Record<ThresholdKey, number>> {
  const raw = process.env.IMAGE_CLASSIFICATION_THRESHOLDS;
  if (!raw || raw.trim() === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const overrides: Partial<Record<ThresholdKey, number>> = {};
    for (const key of Object.keys(CLASSIFICATION_THRESHOLDS) as ThresholdKey[]) {
      const value = parsed[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) {
        overrides[key] = value;
      }
    }
    return overrides;
  } catch {
    console.warn(
      '[Image Classifier] Invalid IMAGE_CLASSIFICATION_THRESHOLDS JSON; using defaults',
    );
    return {};
  }
}

export interface ClassificationRuntimeConfig {
  enabled: boolean;
  concurrency: number;
  modelId: string;
  modelCacheDir: string | null;
  skipExisting: boolean;
  thresholds: Record<ThresholdKey, number>;
}

/** Runtime override from Classify Split Allow % UI (null = use defaults/env). */
let runtimeAllowPercent: number | null = null;

/**
 * Set a uniform risk threshold for all categories (percent 5–90).
 * Used only by Classify Split jobs; clear after the job so Video→Frames stays on defaults.
 */
export function setRuntimeAllowPercent(percent: number | null): void {
  if (percent === null) {
    runtimeAllowPercent = null;
    return;
  }
  const clamped = Math.max(5, Math.min(90, Math.round(percent)));
  runtimeAllowPercent = clamped;
}

export function getRuntimeAllowPercent(): number | null {
  return runtimeAllowPercent;
}

export function clearRuntimeAllowPercent(): void {
  runtimeAllowPercent = null;
}

/** Round model score (0–1) to an integer percent for UI-aligned comparisons. */
export function scoreToPercent(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.round(score * 100);
}

/**
 * Whether a risk label score should count as flagged.
 * Classify Split (allowPercent set): match UI — scores above Allow % flag; at or below stay safe.
 * Default path: fraction threshold plus safe-contrast guard.
 */
export function isRiskLabelFlagged(
  score: number,
  threshold: number,
  safeScore: number,
  allowPercent: number | null = getRuntimeAllowPercent(),
): boolean {
  if (allowPercent !== null) {
    return scoreToPercent(score) > allowPercent;
  }
  return score > threshold && score >= safeScore;
}

function thresholdsFromAllowPercent(percent: number): Record<ThresholdKey, number> {
  const value = percent / 100;
  const keys = Object.keys(CLASSIFICATION_THRESHOLDS) as ThresholdKey[];
  const result = {} as Record<ThresholdKey, number>;
  for (const key of keys) {
    result[key] = value;
  }
  return result;
}

/**
 * How many evenly spaced temp frames to sample for Classify Video.
 * Covers start → middle → end: ~1 per 20s, min 8, max 24.
 */
export function calculateVideoSampleCount(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 8;
  }
  const raw = Math.ceil(durationSeconds / 20);
  return Math.max(8, Math.min(24, raw));
}

export function getClassificationConfig(): ClassificationRuntimeConfig {
  const overrides = parseThresholdOverrides();
  let thresholds = { ...CLASSIFICATION_THRESHOLDS, ...overrides };

  if (runtimeAllowPercent !== null) {
    thresholds = thresholdsFromAllowPercent(runtimeAllowPercent);
  }

  return {
    enabled: parseBooleanEnv(process.env.IMAGE_CLASSIFICATION_ENABLED, true),
    concurrency: parsePositiveIntEnv(process.env.IMAGE_CLASSIFICATION_CONCURRENCY, 2),
    modelId: process.env.IMAGE_CLASSIFICATION_MODEL_ID?.trim() || DEFAULT_MODEL_ID,
    modelCacheDir: process.env.IMAGE_CLASSIFICATION_MODEL_CACHE?.trim() || null,
    skipExisting: parseBooleanEnv(process.env.IMAGE_CLASSIFICATION_SKIP_EXISTING, true),
    thresholds,
  };
}

export function isSupportedImageExtension(fileName: string): boolean {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

export function getCandidateLabels(): string[] {
  return [...RISK_LABEL_DEFINITIONS.map((d) => d.label), SAFE_CONTRAST_LABEL];
}

export function findLabelDefinition(label: string): RiskLabelDefinition | undefined {
  return RISK_LABEL_DEFINITIONS.find((d) => d.label === label);
}

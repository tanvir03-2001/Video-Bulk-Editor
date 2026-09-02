import type { LogEntry } from './ipc';
import {
  DEFAULT_BRANDING_CANVAS_CONFIG,
  DEFAULT_BRANDING_CONFIG,
  DEFAULT_MOVING_TEXT_CONFIG,
  type BrandingConfig,
} from './branding';

export const COMPOSER_DEFAULT_VOLUME_PERCENT = 20;
export const COMPOSER_AUDIO_DELAY_SECONDS = 1;
export const COMPOSER_TRANSITION_SECONDS = 0.5;
export const COMPOSER_FILLER_CLIP_SECONDS = 2.5;
export const COMPOSER_OUTPUT_DIR = 'Combined Videos';

export interface ComposerClip {
  id: string;
  sourcePath: string;
  sourceName: string;
  /** Trim start within the source file. */
  startSeconds: number;
  durationSeconds: number;
  /** Position on the output timeline. */
  timelineOffset: number;
  volumePercent: number;
  muted: boolean;
  isFiller: boolean;
}

export interface ComposerConfig {
  clips: ComposerClip[];
  audioPath: string;
  audioDelaySeconds: number;
  branding: BrandingConfig;
  transitionDurationSeconds: number;
  outputPath: string;
}

export type ComposerStatus =
  | 'idle'
  | 'ready'
  | 'importing'
  | 'analyzing'
  | 'exporting'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface ComposerProgress {
  status: ComposerStatus;
  progressPercent: number;
  currentStep: string | null;
  currentFile: string | null;
  elapsedMs: number;
  encoder: string | null;
  outputPath: string | null;
  targetDurationSeconds: number;
  message: string | null;
  stepIndex: number;
  stepTotal: number;
  stepLabel: string | null;
  nextStepLabel: string | null;
  logs: LogEntry[];
}

export const COMPOSER_STEP_TOTAL = 6;

export const COMPOSER_PIPELINE_STEPS = [
  'Selecting & reading videos',
  'Generating thumbnails & proxy',
  'Reading audio',
  'Planning timeline',
  'Encoding video',
  'Finalizing export',
] as const;

export const INITIAL_COMPOSER_PROGRESS: ComposerProgress = {
  status: 'idle',
  progressPercent: 0,
  currentStep: null,
  currentFile: null,
  elapsedMs: 0,
  encoder: null,
  outputPath: null,
  targetDurationSeconds: 0,
  message: null,
  stepIndex: 0,
  stepTotal: COMPOSER_STEP_TOTAL,
  stepLabel: null,
  nextStepLabel: null,
  logs: [],
};

export type ComposerEventType =
  | 'composer-started'
  | 'composer-progress'
  | 'composer-completed'
  | 'composer-cancelled'
  | 'composer-failed';

export interface ComposerEvent {
  type: ComposerEventType;
  progress: ComposerProgress;
}

export interface ComposerVideoInput {
  path: string;
  name: string;
  extension: string;
  durationSeconds: number;
  width: number;
  height: number;
}

export interface ComposerImportMediaResult {
  thumbnails: Record<string, string[]>;
  proxies: Record<string, string>;
}

export interface ComposerThumbnailRequest {
  videoPaths: string[];
}

export interface ComposerProxyRequest {
  videoPaths: string[];
}

export interface ComposerPlanTimelineRequest {
  videos: ComposerVideoInput[];
  audioDurationSeconds: number;
  clips: ComposerClip[];
}

export interface ComposerPlanTimelineResult {
  clips: ComposerClip[];
  targetDurationSeconds: number;
  audioDurationSeconds: number;
}

export interface ComposerSourceProbe {
  durationSeconds: number;
  hasAudio: boolean;
}

export interface ComposerExportRequest {
  clips: ComposerClip[];
  audioPath: string;
  audioDelaySeconds: number;
  audioDurationSeconds?: number;
  sourceProbes?: Record<string, ComposerSourceProbe>;
  branding: BrandingConfig;
  transitionDurationSeconds: number;
  outputPath: string;
  outputWidth: number;
  outputHeight: number;
}

export interface ComposerPreviewRequest {
  clips: ComposerClip[];
  audioPath?: string | null;
  audioDelaySeconds: number;
  audioDurationSeconds?: number;
  sourceProbes?: Record<string, ComposerSourceProbe>;
  branding: BrandingConfig;
  transitionDurationSeconds: number;
  outputWidth: number;
  outputHeight: number;
}

export interface ComposerPreviewResult {
  outputPath: string;
  durationSeconds: number;
}

export const DEFAULT_COMPOSER_LOGO = DEFAULT_BRANDING_CONFIG.watermark;

export function createDefaultComposerBranding(): BrandingConfig {
  return {
    watermark: { ...DEFAULT_BRANDING_CONFIG.watermark },
    movingText: { ...DEFAULT_MOVING_TEXT_CONFIG },
    canvas: {
      ...DEFAULT_BRANDING_CANVAS_CONFIG,
      top: { ...DEFAULT_BRANDING_CANVAS_CONFIG.top },
      bottom: { ...DEFAULT_BRANDING_CANVAS_CONFIG.bottom },
      left: { ...DEFAULT_BRANDING_CANVAS_CONFIG.left },
      right: { ...DEFAULT_BRANDING_CANVAS_CONFIG.right },
    },
  };
}

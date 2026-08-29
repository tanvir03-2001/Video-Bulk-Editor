import type { LogEntry } from './ipc';

export type WatermarkMode = 'image' | 'text';

export type OverlayPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export const OVERLAY_POSITIONS: OverlayPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export type MovingTextSpeed = 'very-slow' | 'slow' | 'normal';

export const MOVING_TEXT_SPEEDS: MovingTextSpeed[] = ['very-slow', 'slow', 'normal'];

/**
 * Horizontal / vertical drift periods in seconds. Different periods keep the
 * path smooth while wandering across different areas instead of looping tightly.
 */
export const MOVING_TEXT_SPEED_PRESETS: Record<
  MovingTextSpeed,
  { horizontalPeriodSeconds: number; verticalPeriodSeconds: number }
> = {
  'very-slow': { horizontalPeriodSeconds: 90, verticalPeriodSeconds: 140 },
  slow: { horizontalPeriodSeconds: 60, verticalPeriodSeconds: 95 },
  normal: { horizontalPeriodSeconds: 40, verticalPeriodSeconds: 62 },
};

export type BrandingFontFamily = 'sans' | 'serif' | 'mono';

export const BRANDING_FONT_FAMILIES: BrandingFontFamily[] = ['sans', 'serif', 'mono'];

/** Font stacks resolved by the local text rasterizer (no external services). */
export const BRANDING_FONT_STACKS: Record<BrandingFontFamily, string> = {
  sans: 'IBM Plex Sans, Segoe UI, Arial, Helvetica, sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'IBM Plex Mono, Consolas, Courier New, monospace',
};

export type BrandingFontWeight = 'regular' | 'medium' | 'bold';

export const BRANDING_FONT_WEIGHTS: BrandingFontWeight[] = ['regular', 'medium', 'bold'];

export const BRANDING_FONT_WEIGHT_VALUES: Record<BrandingFontWeight, number> = {
  regular: 400,
  medium: 600,
  bold: 800,
};

export interface TextLogoConfig {
  /** Large primary word in the broadcast-style lockup. */
  text: string;
  /** Optional smaller supporting word rendered beneath and aligned right. */
  secondaryText: string;
  fontFamily: BrandingFontFamily;
  /** Cap height as a percentage of video height, so it scales with resolution. */
  fontSizePercent: number;
  fontWeight: BrandingFontWeight;
  /** Hex colour, e.g. #ffffff */
  color: string;
  /** Lightweight drop shadow + outline for readability over bright footage. */
  shadow: boolean;
}

export interface WatermarkConfig {
  enabled: boolean;
  mode: WatermarkMode;
  /** Absolute path to a PNG/JPG/WEBP logo when mode is 'image'. */
  imagePath: string | null;
  text: TextLogoConfig;
  position: OverlayPosition;
  /** Image logo width as a percentage of video width. */
  scalePercent: number;
  opacityPercent: number;
  /** Edge margin as a percentage of video width. */
  marginPercent: number;
}

export interface MovingTextConfig {
  enabled: boolean;
  text: string;
  opacityPercent: number;
  /** Cap height as a percentage of video height. */
  sizePercent: number;
  speed: MovingTextSpeed;
}

export interface BrandingConfig {
  watermark: WatermarkConfig;
  movingText: MovingTextConfig;
}

export const BRANDING_LIMITS = {
  watermarkScalePercent: { min: 2, max: 60, step: 1 },
  watermarkOpacityPercent: { min: 5, max: 100, step: 1 },
  watermarkMarginPercent: { min: 0, max: 20, step: 1 },
  textFontSizePercent: { min: 2, max: 25, step: 1 },
  movingTextOpacityPercent: { min: 3, max: 60, step: 1 },
  movingTextSizePercent: { min: 2, max: 20, step: 1 },
} as const;

export const DEFAULT_TEXT_LOGO_CONFIG: TextLogoConfig = {
  text: 'Smooth',
  secondaryText: 'Radio',
  fontFamily: 'sans',
  fontSizePercent: 6,
  fontWeight: 'bold',
  color: '#ffffff',
  shadow: true,
};

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  enabled: false,
  mode: 'image',
  imagePath: null,
  text: DEFAULT_TEXT_LOGO_CONFIG,
  position: 'bottom-right',
  scalePercent: 15,
  opacityPercent: 80,
  marginPercent: 3,
};

export const DEFAULT_MOVING_TEXT_CONFIG: MovingTextConfig = {
  enabled: false,
  text: 'My Brand',
  opacityPercent: 12,
  sizePercent: 5,
  speed: 'very-slow',
};

export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  watermark: DEFAULT_WATERMARK_CONFIG,
  movingText: DEFAULT_MOVING_TEXT_CONFIG,
};

export const BRANDED_VIDEOS_DIR = 'Branded Videos';
export const BRANDING_REPORT_FILE = 'branding-report.json';

export const SUPPORTED_LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

export type BrandingStatus =
  | 'idle'
  | 'ready'
  | 'no_videos'
  | 'previewing'
  | 'preview_ready'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'error';

export type BrandingJobKind = 'preview' | 'batch';

export interface BrandingProgress {
  status: BrandingStatus;
  jobKind: BrandingJobKind | null;
  selectedFolder: string | null;
  outputFolder: string | null;
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  currentFile: string | null;
  currentVideoIndex: number;
  /** Overall batch percent (0–100). */
  progressPercent: number;
  /** Percent of the video currently being encoded (0–100). */
  currentVideoPercent: number;
  elapsedMs: number;
  encoder: string | null;
  message: string | null;
  logs: LogEntry[];
  /** Absolute path of the last generated preview clip. */
  previewPath: string | null;
  failedFiles: string[];
}

export const INITIAL_BRANDING_PROGRESS: BrandingProgress = {
  status: 'idle',
  jobKind: null,
  selectedFolder: null,
  outputFolder: null,
  totalVideos: 0,
  completedVideos: 0,
  failedVideos: 0,
  currentFile: null,
  currentVideoIndex: 0,
  progressPercent: 0,
  currentVideoPercent: 0,
  elapsedMs: 0,
  encoder: null,
  message: null,
  logs: [],
  previewPath: null,
  failedFiles: [],
};

export type BrandingEventType =
  | 'branding-started'
  | 'branding-progress'
  | 'branding-preview-ready'
  | 'branding-completed'
  | 'branding-cancelled'
  | 'branding-failed';

export interface BrandingEvent {
  type: BrandingEventType;
  progress: BrandingProgress;
}

export interface BrandingPreviewRequest {
  videoPath: string;
  config: BrandingConfig;
}

export interface BrandingBatchRequest {
  folderPath: string;
  videos: Array<{ name: string; path: string; extension: string }>;
  outputFolder: string;
  config: BrandingConfig;
}

export interface BrandingReportEntry {
  video: string;
  status: 'branded' | 'failed';
  outputPath?: string;
  durationMs: number;
  encoder: string;
  reason?: string;
}

export interface BrandingReport {
  totalVideos: number;
  brandedVideos: number;
  failedVideos: number;
  outputFolder: string;
  encoder: string;
  results: BrandingReportEntry[];
}

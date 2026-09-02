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

export type BrandingAspectRatio =
  | 'source'
  | '1:1'
  | '4:5'
  | '9:16'
  | '16:9'
  | '4:3'
  | '3:4'
  | '2:3'
  | '3:2'
  | '21:9'
  | 'custom';

export const BRANDING_ASPECT_RATIOS: BrandingAspectRatio[] = [
  'source',
  '1:1',
  '4:5',
  '9:16',
  '16:9',
  '4:3',
  '3:4',
  '2:3',
  '3:2',
  '21:9',
  'custom',
];

export const BRANDING_ASPECT_RATIO_LABELS: Record<BrandingAspectRatio, string> = {
  source: 'Original',
  '1:1': '1:1 · Square',
  '4:5': '4:5 · Feed portrait',
  '9:16': '9:16 · Story / Reel',
  '16:9': '16:9 · Landscape',
  '4:3': '4:3 · Classic',
  '3:4': '3:4 · Portrait',
  '2:3': '2:3 · Portrait',
  '3:2': '3:2 · Landscape',
  '21:9': '21:9 · Wide',
  custom: 'Custom ratio',
};

export type BrandingSide = 'top' | 'bottom' | 'left' | 'right';

export interface SideImageConfig {
  enabled: boolean;
  /** Absolute path to a PNG/JPG/JPEG/WEBP image. */
  imagePath: string | null;
}

export interface BrandingCanvasConfig {
  aspectRatio: BrandingAspectRatio;
  customWidth: number;
  customHeight: number;
  /** 100 is a normal fit, above 100 crops in, below 100 scales down. */
  zoomPercent: number;
  top: SideImageConfig;
  bottom: SideImageConfig;
  left: SideImageConfig;
  right: SideImageConfig;
}

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
  canvas: BrandingCanvasConfig;
}

export const BRANDING_LIMITS = {
  watermarkScalePercent: { min: 2, max: 60, step: 1 },
  watermarkOpacityPercent: { min: 5, max: 100, step: 1 },
  watermarkMarginPercent: { min: 0, max: 20, step: 1 },
  textFontSizePercent: { min: 2, max: 25, step: 1 },
  movingTextOpacityPercent: { min: 3, max: 60, step: 1 },
  movingTextSizePercent: { min: 2, max: 20, step: 1 },
  customRatio: { min: 1, max: 10000, step: 1 },
  zoomPercent: { min: 50, max: 200, step: 5 },
} as const;

export const DEFAULT_SIDE_IMAGE_CONFIG: SideImageConfig = {
  enabled: false,
  imagePath: null,
};

export const DEFAULT_BRANDING_CANVAS_CONFIG: BrandingCanvasConfig = {
  aspectRatio: 'source',
  customWidth: 16,
  customHeight: 9,
  zoomPercent: 100,
  top: DEFAULT_SIDE_IMAGE_CONFIG,
  bottom: DEFAULT_SIDE_IMAGE_CONFIG,
  left: DEFAULT_SIDE_IMAGE_CONFIG,
  right: DEFAULT_SIDE_IMAGE_CONFIG,
};

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
  canvas: DEFAULT_BRANDING_CANVAS_CONFIG,
};

export const BRANDED_VIDEOS_DIR = 'Branded Videos';
export const BRANDING_REPORT_FILE = 'branding-report.json';

export const SUPPORTED_LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

export function isSupportedLogoExtension(filePath: string): boolean {
  const match = /\.([^.\\/]+)$/i.exec(filePath);
  const ext = match?.[1]?.toLowerCase() ?? '';
  return SUPPORTED_LOGO_EXTENSIONS.includes(ext);
}

export function hasAnyBrandingEnabled(config: BrandingConfig): boolean {
  const canvas = config.canvas;
  const hasSideImage = [canvas.top, canvas.bottom, canvas.left, canvas.right].some(
    (side) => side.enabled,
  );
  const hasCanvasTransform = canvas.aspectRatio !== 'source' || canvas.zoomPercent !== 100;
  return config.watermark.enabled || config.movingText.enabled || hasSideImage || hasCanvasTransform;
}

/**
 * Returns a human-readable reason when the config cannot be rendered, otherwise null.
 */
export function validateBrandingConfig(config: BrandingConfig): string | null {
  if (!hasAnyBrandingEnabled(config)) {
    return 'Enable Watermark, Moving Text, a side image, a canvas format, or zoom before rendering.';
  }

  if (config.watermark.enabled && config.watermark.mode === 'image') {
    if (!config.watermark.imagePath) {
      return 'Select a logo image file for the Image Logo watermark.';
    }
    if (!isSupportedLogoExtension(config.watermark.imagePath)) {
      return `Unsupported logo format. Use ${SUPPORTED_LOGO_EXTENSIONS.join(', ')}.`;
    }
  }

  if (config.canvas.aspectRatio === 'custom') {
    if (
      config.canvas.customWidth < BRANDING_LIMITS.customRatio.min ||
      config.canvas.customHeight < BRANDING_LIMITS.customRatio.min
    ) {
      return 'Custom aspect ratio width and height must be greater than zero.';
    }
  }

  const sideImages = [
    ['Top', config.canvas.top],
    ['Bottom', config.canvas.bottom],
    ['Left', config.canvas.left],
    ['Right', config.canvas.right],
  ] as const;
  for (const [label, side] of sideImages) {
    if (!side.enabled) {
      continue;
    }
    if (!side.imagePath) {
      return `Select an image for the ${label} side.`;
    }
    if (!isSupportedLogoExtension(side.imagePath)) {
      return `Unsupported ${label.toLowerCase()} side image format. Use ${SUPPORTED_LOGO_EXTENSIONS.join(', ')}.`;
    }
  }

  return null;
}

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
  outputWidth?: number;
  outputHeight?: number;
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
  outputAspectRatio: BrandingAspectRatio;
  results: BrandingReportEntry[];
}

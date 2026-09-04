import type { LogEntry, ImageFile } from './ipc';
import {
  BRANDING_ASPECT_RATIOS,
  BRANDING_ASPECT_RATIO_LABELS,
  DEFAULT_BRANDING_CANVAS_CONFIG,
  DEFAULT_TEXT_LOGO_CONFIG,
  type BrandingCanvasConfig,
  type BrandingSide,
  type OverlayPosition,
  type SideImageConfig,
  type TextLogoConfig,
  type WatermarkMode,
} from './branding';

export type ImageEditFilter =
  | 'none'
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'mono'
  | 'sepia'
  | 'cinematic'
  | 'high-contrast';

export const IMAGE_EDIT_FILTERS: ImageEditFilter[] = [
  'none',
  'vivid',
  'warm',
  'cool',
  'mono',
  'sepia',
  'cinematic',
  'high-contrast',
];

export const IMAGE_EDIT_FILTER_LABELS: Record<ImageEditFilter, string> = {
  none: 'Original',
  vivid: 'Vivid',
  warm: 'Warm',
  cool: 'Cool',
  mono: 'Monochrome',
  sepia: 'Sepia',
  cinematic: 'Cinematic',
  'high-contrast': 'High contrast',
};

export const IMAGE_EDIT_ASPECT_RATIOS = BRANDING_ASPECT_RATIOS;
export const IMAGE_EDIT_ASPECT_RATIO_LABELS = BRANDING_ASPECT_RATIO_LABELS;

export type ImageEditCropMode = 'cover' | 'contain';

export const IMAGE_EDIT_CROP_MODES: ImageEditCropMode[] = ['cover', 'contain'];

export const IMAGE_EDIT_CROP_MODE_LABELS: Record<ImageEditCropMode, string> = {
  cover: 'Fill canvas · crop edges',
  contain: 'Show full image · fit inside',
};

export interface ImageEditWatermarkConfig {
  enabled: boolean;
  mode: WatermarkMode;
  imagePath: string | null;
  text: TextLogoConfig;
  position: OverlayPosition;
  scalePercent: number;
  opacityPercent: number;
  marginPercent: number;
}

export interface ImageEditTuningConfig {
  brightnessPercent: number;
  contrastPercent: number;
  saturationPercent: number;
  temperaturePercent: number;
  hueDegrees: number;
  sharpenPercent: number;
}

export interface ImageEditConfig {
  canvas: BrandingCanvasConfig;
  cropMode: ImageEditCropMode;
  backgroundColor: string;
  presetId: string | null;
  presetName: string | null;
  filter: ImageEditFilter;
  tuning: ImageEditTuningConfig;
  watermark: ImageEditWatermarkConfig;
  outputFormat: 'jpg' | 'png' | 'webp';
  qualityPercent: number;
}

export const IMAGE_EDIT_LIMITS = {
  customRatio: { min: 1, max: 10000, step: 1 },
  zoomPercent: { min: 50, max: 200, step: 5 },
  brightnessPercent: { min: -100, max: 100, step: 1 },
  contrastPercent: { min: -100, max: 100, step: 1 },
  saturationPercent: { min: -100, max: 100, step: 1 },
  temperaturePercent: { min: -100, max: 100, step: 1 },
  hueDegrees: { min: -180, max: 180, step: 1 },
  sharpenPercent: { min: 0, max: 100, step: 1 },
  watermarkScalePercent: { min: 2, max: 60, step: 1 },
  watermarkOpacityPercent: { min: 5, max: 100, step: 1 },
  watermarkMarginPercent: { min: 0, max: 20, step: 1 },
  qualityPercent: { min: 40, max: 100, step: 1 },
} as const;

export const DEFAULT_IMAGE_EDIT_TUNING: ImageEditTuningConfig = {
  brightnessPercent: 0,
  contrastPercent: 0,
  saturationPercent: 0,
  temperaturePercent: 0,
  hueDegrees: 0,
  sharpenPercent: 0,
};

export const DEFAULT_IMAGE_EDIT_WATERMARK: ImageEditWatermarkConfig = {
  enabled: false,
  mode: 'image',
  imagePath: null,
  text: { ...DEFAULT_TEXT_LOGO_CONFIG },
  position: 'bottom-right',
  scalePercent: 15,
  opacityPercent: 80,
  marginPercent: 3,
};

export const DEFAULT_IMAGE_EDIT_CONFIG: ImageEditConfig = {
  canvas: {
    ...DEFAULT_BRANDING_CANVAS_CONFIG,
    top: { ...DEFAULT_BRANDING_CANVAS_CONFIG.top },
    bottom: { ...DEFAULT_BRANDING_CANVAS_CONFIG.bottom },
    left: { ...DEFAULT_BRANDING_CANVAS_CONFIG.left },
    right: { ...DEFAULT_BRANDING_CANVAS_CONFIG.right },
  },
  cropMode: 'cover',
  backgroundColor: '#12141a',
  presetId: null,
  presetName: null,
  filter: 'none',
  tuning: DEFAULT_IMAGE_EDIT_TUNING,
  watermark: DEFAULT_IMAGE_EDIT_WATERMARK,
  outputFormat: 'jpg',
  qualityPercent: 92,
};

export const EDITED_IMAGES_DIR = 'Edited Images';
export const IMAGE_EDIT_REPORT_FILE = 'image-edit-report.json';
export const SUPPORTED_IMAGE_EDIT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp'];

export interface ImageEditPresetSummary {
  id: string;
  name: string;
  group: string;
  origin: 'bundled' | 'imported';
  filter: ImageEditFilter;
  tuning: Partial<ImageEditTuningConfig>;
}

export type ImageEditStatus =
  | 'idle'
  | 'ready'
  | 'no_images'
  | 'previewing'
  | 'preview_ready'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'error';

export type ImageEditJobKind = 'preview' | 'batch';

export interface ImageEditProgress {
  status: ImageEditStatus;
  jobKind: ImageEditJobKind | null;
  selectedFolder: string | null;
  outputFolder: string | null;
  totalImages: number;
  completedImages: number;
  failedImages: number;
  currentFile: string | null;
  currentImageIndex: number;
  progressPercent: number;
  elapsedMs: number;
  message: string | null;
  logs: LogEntry[];
  previewPath: string | null;
  previewWidth: number | null;
  previewHeight: number | null;
  failedFiles: string[];
}

export const INITIAL_IMAGE_EDIT_PROGRESS: ImageEditProgress = {
  status: 'idle',
  jobKind: null,
  selectedFolder: null,
  outputFolder: null,
  totalImages: 0,
  completedImages: 0,
  failedImages: 0,
  currentFile: null,
  currentImageIndex: 0,
  progressPercent: 0,
  elapsedMs: 0,
  message: null,
  logs: [],
  previewPath: null,
  previewWidth: null,
  previewHeight: null,
  failedFiles: [],
};

export type ImageEditEventType =
  | 'image-edit-started'
  | 'image-edit-progress'
  | 'image-edit-preview-ready'
  | 'image-edit-completed'
  | 'image-edit-cancelled'
  | 'image-edit-failed';

export interface ImageEditEvent {
  type: ImageEditEventType;
  progress: ImageEditProgress;
}

export interface ImageEditPreviewRequest {
  imagePath: string;
  config: ImageEditConfig;
}

export interface ImageEditBatchRequest {
  folderPath: string;
  images: ImageFile[];
  outputFolder: string;
  config: ImageEditConfig;
}

export interface ImageEditReportEntry {
  image: string;
  status: 'edited' | 'failed';
  outputPath?: string;
  outputWidth?: number;
  outputHeight?: number;
  durationMs: number;
  reason?: string;
}

export interface ImageEditReport {
  totalImages: number;
  editedImages: number;
  failedImages: number;
  outputFolder: string;
  outputFormat: ImageEditConfig['outputFormat'];
  filter: ImageEditFilter;
  presetId?: string | null;
  presetName?: string | null;
  results: ImageEditReportEntry[];
}

export type ImageEditSideImage = {
  side: BrandingSide;
  config: SideImageConfig;
};

import type {
  BrandingBatchRequest,
  BrandingEvent,
  BrandingPreviewRequest,
} from './branding';
import type {
  ComposerEvent,
  ComposerExportRequest,
  ComposerImportMediaResult,
  ComposerPlanTimelineRequest,
  ComposerPlanTimelineResult,
  ComposerPreviewRequest,
  ComposerPreviewResult,
  ComposerThumbnailRequest,
} from '../shared/composer';
import type {
  ImageEditBatchRequest,
  ImageEditEvent,
  ImageEditPreviewRequest,
  ImageEditPresetSummary,
} from './imageEditing';

export interface VideoFile {
  name: string;
  path: string;
  extension: string;
}

export interface ImageFile {
  name: string;
  path: string;
  extension: string;
}

export type ProcessingStatus =
  | 'idle'
  | 'ready'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'no_videos'
  | 'error';

export type ImageClassificationStatus =
  | 'idle'
  | 'ready'
  | 'no_images'
  | 'classifying'
  | 'completed'
  | 'cancelled'
  | 'error';
export interface QueueItem {
  video: VideoFile;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  imagesGenerated: number;
  error?: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'success' | 'error' | 'info';
  message: string;
}

export interface ProcessingProgress {
  status: ProcessingStatus;
  selectedFolder: string | null;
  totalVideos: number;
  completedVideos: number;
  remainingVideos: number;
  failedVideos: number;
  imagesGenerated: number;
  currentFile: string | null;
  currentImageIndex: number;
  currentImageTotal: number;
  progressPercent: number;
  elapsedMs: number;
  message: string | null;
  logs: LogEntry[];
  ffmpegAvailable: boolean;
  ffmpegError: string | null;
  /** Active pipeline step shown in the main UI */
  currentStep: 'idle' | 'extracting' | 'checking' | 'retrying' | 'classifying' | 'done';
}

export interface ProcessingResult {
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  imagesGenerated: number;
  elapsedMs: number;
  cancelled: boolean;
}

export const INITIAL_PROGRESS: ProcessingProgress = {
  status: 'idle',
  selectedFolder: null,
  totalVideos: 0,
  completedVideos: 0,
  remainingVideos: 0,
  failedVideos: 0,
  imagesGenerated: 0,
  currentFile: null,
  currentImageIndex: 0,
  currentImageTotal: 0,
  progressPercent: 0,
  elapsedMs: 0,
  message: null,
  logs: [],
  ffmpegAvailable: true,
  ffmpegError: null,
  currentStep: 'idle',
};

export interface ImageClassificationProgress {
  status: ImageClassificationStatus;
  selectedFolder: string | null;
  imageCount: number;
  videoCount: number;
  processedCount: number;
  safeImages: number;
  flaggedImages: number;
  classificationFailed: number;
  skipped: number;
  currentFile: string | null;
  currentImageIndex: number;
  currentImageTotal: number;
  progressPercent: number;
  elapsedMs: number;
  message: string | null;
  logs: LogEntry[];
  /** High-level step for the main processing UI */
  currentStep: 'idle' | 'extracting' | 'classifying' | 'done';
}

export const INITIAL_IMAGE_CLASSIFICATION_PROGRESS: ImageClassificationProgress = {
  status: 'idle',
  selectedFolder: null,
  imageCount: 0,
  videoCount: 0,
  processedCount: 0,
  safeImages: 0,
  flaggedImages: 0,
  classificationFailed: 0,
  skipped: 0,
  currentFile: null,
  currentImageIndex: 0,
  currentImageTotal: 0,
  progressPercent: 0,
  elapsedMs: 0,
  message: null,
  logs: [],
  currentStep: 'idle',
};

export const IpcChannels = {
  SELECT_FOLDER: 'select-folder',
  SCAN_VIDEOS: 'scan-videos',
  START_PROCESSING: 'start-processing',
  CANCEL_PROCESSING: 'cancel-processing',
  CHECK_FFMPEG: 'check-ffmpeg',
  PROGRESS_EVENT: 'processing-event',
  SCAN_IMAGES: 'scan-images',
  SCAN_CLASSIFICATION_FOLDER: 'scan-classification-folder',
  START_IMAGE_CLASSIFICATION: 'start-image-classification',
  CANCEL_IMAGE_CLASSIFICATION: 'cancel-image-classification',
  IMAGE_CLASSIFICATION_EVENT: 'image-classification-event',
  SELECT_BRANDING_LOGO: 'select-branding-logo',
  SELECT_BRANDING_OUTPUT_FOLDER: 'select-branding-output-folder',
  RESOLVE_BRANDING_OUTPUT_FOLDER: 'resolve-branding-output-folder',
  START_BRANDING_PREVIEW: 'start-branding-preview',
  START_BRANDING_BATCH: 'start-branding-batch',
  CANCEL_BRANDING: 'cancel-branding',
  READ_BRANDING_PREVIEW_FILE: 'read-branding-preview-file',
  BRANDING_EVENT: 'branding-event',
  SELECT_IMAGE_EDIT_OUTPUT_FOLDER: 'select-image-edit-output-folder',
  RESOLVE_IMAGE_EDIT_OUTPUT_FOLDER: 'resolve-image-edit-output-folder',
  START_IMAGE_EDIT_PREVIEW: 'start-image-edit-preview',
  START_IMAGE_EDIT_BATCH: 'start-image-edit-batch',
  CANCEL_IMAGE_EDIT: 'cancel-image-edit',
  READ_IMAGE_EDIT_PREVIEW_FILE: 'read-image-edit-preview-file',
  IMAGE_EDIT_EVENT: 'image-edit-event',
  LIST_IMAGE_EDIT_PRESETS: 'list-image-edit-presets',
  SELECT_IMAGE_EDIT_PRESET_FOLDER: 'select-image-edit-preset-folder',
  IMPORT_IMAGE_EDIT_PRESETS: 'import-image-edit-presets',
  PREVIEW_IMAGE_EDIT_PRESET: 'preview-image-edit-preset',
  GET_LOCAL_MEDIA_URL: 'get-local-media-url',
  SELECT_COMPOSER_VIDEOS: 'select-composer-videos',
  SELECT_COMPOSER_AUDIO: 'select-composer-audio',
  GENERATE_COMPOSER_THUMBNAILS: 'generate-composer-thumbnails',
  GENERATE_COMPOSER_PREVIEW: 'generate-composer-preview',
  CANCEL_COMPOSER_PREVIEW: 'cancel-composer-preview',
  PLAN_COMPOSER_TIMELINE: 'plan-composer-timeline',
  START_COMPOSER_EXPORT: 'start-composer-export',
  CANCEL_COMPOSER: 'cancel-composer',
  COMPOSER_EVENT: 'composer-event',
  RESOLVE_COMPOSER_OUTPUT_PATH: 'resolve-composer-output-path',
  PROBE_COMPOSER_VIDEO: 'probe-composer-video',
  PROBE_COMPOSER_AUDIO: 'probe-composer-audio',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export type ProgressEventType =
  | 'processing-started'
  | 'video-started'
  | 'video-progress'
  | 'video-completed'
  | 'video-failed'
  | 'processing-progress'
  | 'processing-completed'
  | 'processing-cancelled'
  | 'scan-completed'
  | 'ffmpeg-status';

export interface ProgressEvent {
  type: ProgressEventType;
  progress: ProcessingProgress;
}

export type ImageClassificationEventType =
  | 'classification-started'
  | 'classification-progress'
  | 'classification-completed'
  | 'classification-cancelled'
  | 'classification-failed';

export interface ImageClassificationEvent {
  type: ImageClassificationEventType;
  progress: ImageClassificationProgress;
}

export interface ScanResult {
  folder: string;
  videos: VideoFile[];
}

export interface ImageScanResult {
  folder: string;
  images: ImageFile[];
}

export interface ClassificationFolderScanResult {
  folder: string;
  images: ImageFile[];
  videos: VideoFile[];
}

export interface StartProcessingRequest {
  folderPath: string;
  videos: VideoFile[];
  /** Uniform Allow % (5–90). Scores above this go flagged. Default 25. */
  allowPercent: number;
}

export interface StartImageClassificationRequest {
  folderPath: string;
  imageCount: number;
  videos: VideoFile[];
  /** Uniform Allow % (5–90). Scores above this go flagged. Default 25. */
  allowPercent: number;
}

export interface FfmpegStatus {
  available: boolean;
  error: string | null;
}

export interface ElectronApi {
  selectFolder: () => Promise<string | null>;
  scanVideos: (folderPath: string) => Promise<ScanResult>;
  startProcessing: (request: StartProcessingRequest) => Promise<void>;
  cancelProcessing: () => Promise<void>;
  checkFfmpeg: () => Promise<FfmpegStatus>;
  onProgress: (callback: (event: ProgressEvent) => void) => () => void;
  scanImages: (folderPath: string) => Promise<ImageScanResult>;
  scanClassificationFolder: (folderPath: string) => Promise<ClassificationFolderScanResult>;
  startImageClassification: (request: StartImageClassificationRequest) => Promise<void>;
  cancelImageClassification: () => Promise<void>;
  onImageClassification: (callback: (event: ImageClassificationEvent) => void) => () => void;
  selectBrandingLogo: () => Promise<string | null>;
  selectBrandingOutputFolder: () => Promise<string | null>;
  resolveBrandingOutputFolder: (folderPath: string) => Promise<string>;
  startBrandingPreview: (request: BrandingPreviewRequest) => Promise<void>;
  startBrandingBatch: (request: BrandingBatchRequest) => Promise<void>;
  cancelBranding: () => Promise<void>;
  readBrandingPreviewFile: (previewPath: string) => Promise<Uint8Array>;
  onBranding: (callback: (event: BrandingEvent) => void) => () => void;
  selectImageEditOutputFolder: () => Promise<string | null>;
  resolveImageEditOutputFolder: (folderPath: string) => Promise<string>;
  startImageEditPreview: (request: ImageEditPreviewRequest) => Promise<void>;
  startImageEditBatch: (request: ImageEditBatchRequest) => Promise<void>;
  cancelImageEdit: () => Promise<void>;
  readImageEditPreviewFile: (previewPath: string) => Promise<string>;
  onImageEdit: (callback: (event: ImageEditEvent) => void) => () => void;
  listImageEditPresets: () => Promise<ImageEditPresetSummary[]>;
  selectImageEditPresetFolder: () => Promise<string | null>;
  importImageEditPresets: (folderPath: string) => Promise<ImageEditPresetSummary[]>;
  previewImageEditPreset: (presetId: string) => Promise<string>;
  getLocalMediaUrl: (filePath: string) => Promise<string>;
  selectComposerVideos: () => Promise<Array<{ name: string; path: string; extension: string }>>;
  selectComposerAudio: () => Promise<string | null>;
  generateComposerThumbnails: (
    request: ComposerThumbnailRequest,
  ) => Promise<ComposerImportMediaResult>;
  generateComposerPreview: (request: ComposerPreviewRequest) => Promise<ComposerPreviewResult>;
  cancelComposerPreview: () => Promise<void>;
  planComposerTimeline: (request: ComposerPlanTimelineRequest) => Promise<ComposerPlanTimelineResult>;
  startComposerExport: (request: ComposerExportRequest) => Promise<void>;
  cancelComposer: () => Promise<void>;
  onComposer: (callback: (event: ComposerEvent) => void) => () => void;
  resolveComposerOutputPath: () => Promise<string>;
  probeComposerVideo: (
    filePath: string,
  ) => Promise<{ durationSeconds: number; width: number; height: number; hasAudio: boolean }>;
  probeComposerAudio: (filePath: string) => Promise<number>;
}
declare global {
  interface Window {
    api: ElectronApi;
  }
}

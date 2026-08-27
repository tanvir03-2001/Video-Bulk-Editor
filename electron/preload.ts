import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IpcChannels,
  type ClassificationFolderScanResult,
  type ElectronApi,
  type FfmpegStatus,
  type ImageClassificationEvent,
  type ImageScanResult,
  type ProgressEvent,
  type ScanResult,
  type StartImageClassificationRequest,
  type StartProcessingRequest,
} from '../shared/ipc';
import type {
  BrandingBatchRequest,
  BrandingEvent,
  BrandingPreviewRequest,
} from '../shared/branding';

const api: ElectronApi = {
  selectFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke(IpcChannels.SELECT_FOLDER) as Promise<string | null>;
  },

  scanVideos: (folderPath: string): Promise<ScanResult> => {
    return ipcRenderer.invoke(IpcChannels.SCAN_VIDEOS, folderPath) as Promise<ScanResult>;
  },

  startProcessing: (request: StartProcessingRequest): Promise<void> => {
    return ipcRenderer.invoke(IpcChannels.START_PROCESSING, request) as Promise<void>;
  },

  cancelProcessing: (): Promise<void> => {
    return ipcRenderer.invoke(IpcChannels.CANCEL_PROCESSING) as Promise<void>;
  },

  checkFfmpeg: (): Promise<FfmpegStatus> => {
    return ipcRenderer.invoke(IpcChannels.CHECK_FFMPEG) as Promise<FfmpegStatus>;
  },

  onProgress: (callback: (event: ProgressEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: ProgressEvent): void => {
      callback(payload);
    };
    ipcRenderer.on(IpcChannels.PROGRESS_EVENT, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.PROGRESS_EVENT, listener);
    };
  },

  scanImages: (folderPath: string): Promise<ImageScanResult> => {
    return ipcRenderer.invoke(IpcChannels.SCAN_IMAGES, folderPath) as Promise<ImageScanResult>;
  },

  scanClassificationFolder: (folderPath: string): Promise<ClassificationFolderScanResult> => {
    return ipcRenderer.invoke(
      IpcChannels.SCAN_CLASSIFICATION_FOLDER,
      folderPath,
    ) as Promise<ClassificationFolderScanResult>;
  },

  startImageClassification: (request: StartImageClassificationRequest): Promise<void> => {
    return ipcRenderer.invoke(IpcChannels.START_IMAGE_CLASSIFICATION, request) as Promise<void>;
  },

  cancelImageClassification: (): Promise<void> => {
    return ipcRenderer.invoke(IpcChannels.CANCEL_IMAGE_CLASSIFICATION) as Promise<void>;
  },

  onImageClassification: (callback: (event: ImageClassificationEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: ImageClassificationEvent): void => {
      callback(payload);
    };
    ipcRenderer.on(IpcChannels.IMAGE_CLASSIFICATION_EVENT, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.IMAGE_CLASSIFICATION_EVENT, listener);
    };
  },

  selectBrandingLogo: (): Promise<string | null> => {
    return ipcRenderer.invoke(IpcChannels.SELECT_BRANDING_LOGO) as Promise<string | null>;
  },

  selectBrandingOutputFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke(IpcChannels.SELECT_BRANDING_OUTPUT_FOLDER) as Promise<string | null>;
  },

  resolveBrandingOutputFolder: (folderPath: string): Promise<string> => {
    return ipcRenderer.invoke(
      IpcChannels.RESOLVE_BRANDING_OUTPUT_FOLDER,
      folderPath,
    ) as Promise<string>;
  },

  startBrandingPreview: (request: BrandingPreviewRequest): Promise<void> => {
    return ipcRenderer.invoke(IpcChannels.START_BRANDING_PREVIEW, request) as Promise<void>;
  },

  startBrandingBatch: (request: BrandingBatchRequest): Promise<void> => {
    return ipcRenderer.invoke(IpcChannels.START_BRANDING_BATCH, request) as Promise<void>;
  },

  cancelBranding: (): Promise<void> => {
    return ipcRenderer.invoke(IpcChannels.CANCEL_BRANDING) as Promise<void>;
  },

  readBrandingPreviewFile: (previewPath: string): Promise<Uint8Array> => {
    return ipcRenderer.invoke(
      IpcChannels.READ_BRANDING_PREVIEW_FILE,
      previewPath,
    ) as Promise<Uint8Array>;
  },

  onBranding: (callback: (event: BrandingEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: BrandingEvent): void => {
      callback(payload);
    };
    ipcRenderer.on(IpcChannels.BRANDING_EVENT, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.BRANDING_EVENT, listener);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);

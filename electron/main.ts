import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  IpcChannels,
  type StartImageClassificationRequest,
  type StartProcessingRequest,
  type VideoFile,
} from '../shared/ipc';
import { SUPPORTED_LOGO_EXTENSIONS } from '../shared/branding';
import { APP_DISPLAY_NAME } from '../shared/appMeta';
import { BrandingRunner } from './services/branding/brandingRunner';
import {
  resolveDefaultOutputFolder,
  sanitizeBrandingConfig,
} from './services/branding/brandingConfig';
import { ClassificationRunner } from './services/classificationRunner';
import { assertFfmpegAvailable } from './services/ffmpegPaths';
import { scanImagesInFolder } from './services/imageScanner';
import { configureModelCacheDir } from './services/localRiskModel';
import { ProcessingQueue } from './services/processingQueue';
import { scanVideosInFolder } from './services/videoScanner';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const queue = new ProcessingQueue();
const classificationRunner = new ClassificationRunner(() => queue.isRunning());
const brandingRunner = new BrandingRunner(
  () => queue.isRunning() || classificationRunner.isRunning(),
);

let mainWindow: BrowserWindow | null = null;

function isValidAbsolutePath(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && path.isAbsolute(value);
}

function isVideoFileArray(value: unknown): value is VideoFile[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as VideoFile).name === 'string' &&
      typeof (item as VideoFile).path === 'string' &&
      typeof (item as VideoFile).extension === 'string' &&
      path.isAbsolute((item as VideoFile).path),
  );
}

function isStartProcessingRequest(value: unknown): value is StartProcessingRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const request = value as StartProcessingRequest;
  return (
    isValidAbsolutePath(request.folderPath) &&
    isVideoFileArray(request.videos) &&
    typeof request.allowPercent === 'number' &&
    Number.isFinite(request.allowPercent) &&
    request.allowPercent >= 5 &&
    request.allowPercent <= 90
  );
}

function isStartImageClassificationRequest(
  value: unknown,
): value is StartImageClassificationRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const request = value as StartImageClassificationRequest;
  return (
    isValidAbsolutePath(request.folderPath) &&
    typeof request.imageCount === 'number' &&
    Number.isFinite(request.imageCount) &&
    request.imageCount >= 0 &&
    isVideoFileArray(request.videos) &&
    typeof request.allowPercent === 'number' &&
    Number.isFinite(request.allowPercent) &&
    request.allowPercent >= 5 &&
    request.allowPercent <= 90
  );
}

function assertNoJobRunning(currentJob: 'processing' | 'classification' | 'branding'): void {
  if (currentJob !== 'processing' && queue.isRunning()) {
    throw new Error('Video processing is already running');
  }
  if (currentJob !== 'classification' && classificationRunner.isRunning()) {
    throw new Error('Image classification is already running');
  }
  if (currentJob !== 'branding' && brandingRunner.isRunning()) {
    throw new Error('Video branding is already running');
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 700,
    title: APP_DISPLAY_NAME,
    backgroundColor: '#12141a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.maximize();

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function broadcastProgress(): void {
  const unsubscribeVideo = queue.onProgress((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.PROGRESS_EVENT, event);
    }
  });

  const unsubscribeClassification = classificationRunner.onProgress((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.IMAGE_CLASSIFICATION_EVENT, event);
    }
  });

  const unsubscribeBranding = brandingRunner.onProgress((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.BRANDING_EVENT, event);
    }
  });

  app.on('before-quit', () => {
    unsubscribeVideo();
    unsubscribeClassification();
    unsubscribeBranding();
    void brandingRunner.dispose();
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.CHECK_FFMPEG, () => {
    const status = assertFfmpegAvailable();
    queue.setFfmpegStatus(status.available, status.error);
    return status;
  });

  ipcMain.handle(IpcChannels.SELECT_FOLDER, async () => {
    if (!mainWindow) {
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Folder',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IpcChannels.SCAN_VIDEOS, async (_event, folderPath: unknown) => {
    if (!isValidAbsolutePath(folderPath)) {
      throw new Error('Invalid folder path');
    }

    const videos = await scanVideosInFolder(folderPath);
    queue.setFolderScan(folderPath, videos);
    return { folder: folderPath, videos };
  });

  ipcMain.handle(IpcChannels.START_PROCESSING, async (_event, request: unknown) => {
    if (!isStartProcessingRequest(request)) {
      throw new Error('Invalid processing request');
    }
    if (queue.isRunning()) {
      throw new Error('Processing is already running');
    }
    assertNoJobRunning('processing');

    void queue.start(request);
  });

  ipcMain.handle(IpcChannels.CANCEL_PROCESSING, () => {
    queue.cancel();
  });

  ipcMain.handle(IpcChannels.SCAN_IMAGES, async (_event, folderPath: unknown) => {
    if (!isValidAbsolutePath(folderPath)) {
      throw new Error('Invalid folder path');
    }

    const images = await scanImagesInFolder(folderPath);
    return { folder: folderPath, images };
  });

  ipcMain.handle(IpcChannels.SCAN_CLASSIFICATION_FOLDER, async (_event, folderPath: unknown) => {
    if (!isValidAbsolutePath(folderPath)) {
      throw new Error('Invalid folder path');
    }

    const [images, videos] = await Promise.all([
      scanImagesInFolder(folderPath),
      scanVideosInFolder(folderPath),
    ]);
    return { folder: folderPath, images, videos };
  });

  ipcMain.handle(IpcChannels.START_IMAGE_CLASSIFICATION, async (_event, request: unknown) => {
    if (!isStartImageClassificationRequest(request)) {
      throw new Error('Invalid classification request');
    }
    if (classificationRunner.isRunning()) {
      throw new Error('Image classification is already running');
    }
    assertNoJobRunning('classification');

    void classificationRunner.start(request);
  });

  ipcMain.handle(IpcChannels.CANCEL_IMAGE_CLASSIFICATION, () => {
    classificationRunner.cancel();
  });

  registerBrandingHandlers();
}

function registerBrandingHandlers(): void {
  ipcMain.handle(IpcChannels.SELECT_BRANDING_LOGO, async () => {
    if (!mainWindow) {
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Branding Image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: SUPPORTED_LOGO_EXTENSIONS }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IpcChannels.SELECT_BRANDING_OUTPUT_FOLDER, async () => {
    if (!mainWindow) {
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Output Folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IpcChannels.RESOLVE_BRANDING_OUTPUT_FOLDER, (_event, folderPath: unknown) => {
    if (!isValidAbsolutePath(folderPath)) {
      throw new Error('Invalid folder path');
    }
    return resolveDefaultOutputFolder(folderPath);
  });

  ipcMain.handle(IpcChannels.START_BRANDING_PREVIEW, async (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null) {
      throw new Error('Invalid preview request');
    }
    const { videoPath, config } = request as { videoPath: unknown; config: unknown };
    if (!isValidAbsolutePath(videoPath)) {
      throw new Error('Select a preview video first');
    }
    if (brandingRunner.isRunning()) {
      throw new Error('Video branding is already running');
    }
    assertNoJobRunning('branding');

    void brandingRunner.startPreview({
      videoPath,
      config: sanitizeBrandingConfig(config),
    });
  });

  ipcMain.handle(IpcChannels.START_BRANDING_BATCH, async (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null) {
      throw new Error('Invalid branding request');
    }
    const { folderPath, videos, outputFolder, config } = request as {
      folderPath: unknown;
      videos: unknown;
      outputFolder: unknown;
      config: unknown;
    };

    if (!isValidAbsolutePath(folderPath)) {
      throw new Error('Invalid folder path');
    }
    if (!isVideoFileArray(videos)) {
      throw new Error('Invalid video list');
    }
    if (!isValidAbsolutePath(outputFolder)) {
      throw new Error('Invalid output folder');
    }
    if (path.resolve(outputFolder) === path.resolve(folderPath)) {
      throw new Error('Output folder must be different from the source folder');
    }
    if (brandingRunner.isRunning()) {
      throw new Error('Video branding is already running');
    }
    assertNoJobRunning('branding');

    void brandingRunner.startBatch({
      folderPath,
      videos,
      outputFolder,
      config: sanitizeBrandingConfig(config),
    });
  });

  ipcMain.handle(IpcChannels.CANCEL_BRANDING, () => {
    brandingRunner.cancel();
  });

  ipcMain.handle(IpcChannels.READ_BRANDING_PREVIEW_FILE, async (_event, previewPath: unknown) => {
    if (!isValidAbsolutePath(previewPath)) {
      throw new Error('Invalid preview path');
    }
    // Only the clip this app just generated may be read back into the renderer.
    const currentPreview = brandingRunner.getProgress().previewPath;
    if (!currentPreview || path.resolve(currentPreview) !== path.resolve(previewPath)) {
      throw new Error('Preview is no longer available');
    }

    return fs.readFile(previewPath);
  });
}

app.whenReady().then(() => {
  // Local CLIP model cache under Electron userData (overridable via IMAGE_CLASSIFICATION_MODEL_CACHE).
  if (!process.env.IMAGE_CLASSIFICATION_MODEL_CACHE) {
    configureModelCacheDir(path.join(app.getPath('userData'), 'models'));
  } else {
    configureModelCacheDir(process.env.IMAGE_CLASSIFICATION_MODEL_CACHE);
  }

  registerIpcHandlers();
  broadcastProgress();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

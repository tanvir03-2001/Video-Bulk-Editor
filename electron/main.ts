import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  IpcChannels,
  type ImageFile,
  type StartImageClassificationRequest,
  type StartProcessingRequest,
  type VideoFile,
} from '../shared/ipc';
import { ImageEditingRunner } from './services/imageEditing/imageEditingRunner';
import {
  DEFAULT_IMAGE_EDIT_CONFIG,
} from '../shared/imageEditing';
import {
  resolveDefaultImageEditOutputFolder,
  sanitizeImageEditConfig,
} from './services/imageEditing/imageEditingConfig';
import {
  getImageEditPresetById,
  getImageEditPresets,
  getImageEditPreviewSource,
  importImageEditPresets,
} from './services/imageEditing/presetLibrary';
import { SUPPORTED_LOGO_EXTENSIONS } from '../shared/branding';
import { APP_DISPLAY_NAME } from '../shared/appMeta';
import { BrandingRunner } from './services/branding/brandingRunner';
import { ComposerRunner } from './services/composer/composerRunner';
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
import { probeMediaFile } from './services/mediaProbe';
import { getVideoDurationSeconds } from './services/frameGenerator';
import { renderImagePreview } from './services/imageEditing/imageEditor';
import { toLocalMediaUrl, parseLocalMediaUrl } from './services/localMedia';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const queue = new ProcessingQueue();
const classificationRunner = new ClassificationRunner(() => queue.isRunning());
const mediaRunners = {} as { brandingRunner: BrandingRunner; composerRunner: ComposerRunner };
mediaRunners.brandingRunner = new BrandingRunner(
  () =>
    queue.isRunning() ||
    classificationRunner.isRunning() ||
    mediaRunners.composerRunner.isRunning(),
);
mediaRunners.composerRunner = new ComposerRunner(
  () =>
    queue.isRunning() ||
    classificationRunner.isRunning() ||
    mediaRunners.brandingRunner.isRunning(),
);
const { brandingRunner, composerRunner } = mediaRunners;
const imageEditingRunner = new ImageEditingRunner(
  () =>
    queue.isRunning() ||
    classificationRunner.isRunning() ||
    brandingRunner.isRunning() ||
    composerRunner.isRunning(),
);
const presetPreviewCache = new Map<string, string>();

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

function isImageFileArray(value: unknown): value is ImageFile[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as ImageFile).name === 'string' &&
      typeof (item as ImageFile).path === 'string' &&
      typeof (item as ImageFile).extension === 'string' &&
      path.isAbsolute((item as ImageFile).path),
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

function assertNoJobRunning(
  currentJob: 'processing' | 'classification' | 'branding' | 'image-editing' | 'composer',
): void {
  if (currentJob !== 'processing' && queue.isRunning()) {
    throw new Error('Video processing is already running');
  }
  if (currentJob !== 'classification' && classificationRunner.isRunning()) {
    throw new Error('Image classification is already running');
  }
  if (currentJob !== 'branding' && brandingRunner.isRunning()) {
    throw new Error('Video branding is already running');
  }
  if (currentJob !== 'image-editing' && imageEditingRunner.isRunning()) {
    throw new Error('Image editing is already running');
  }
  if (currentJob !== 'composer' && composerRunner.isRunning()) {
    throw new Error('Video combiner is already running');
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
  const unsubscribeComposer = composerRunner.onProgress((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.COMPOSER_EVENT, event);
    }
  });
  const unsubscribeImageEditing = imageEditingRunner.onProgress((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.IMAGE_EDIT_EVENT, event);
    }
  });

  app.on('before-quit', () => {
    unsubscribeVideo();
    unsubscribeClassification();
    unsubscribeBranding();
    unsubscribeComposer();
    unsubscribeImageEditing();
    void brandingRunner.dispose();
    void composerRunner.dispose();
    void imageEditingRunner.dispose();
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
  registerComposerHandlers();
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

    return new Uint8Array(await fs.readFile(previewPath));
  });

  ipcMain.handle(IpcChannels.GET_LOCAL_MEDIA_URL, (_event, filePath: unknown) => {
    if (!isValidAbsolutePath(filePath)) {
      throw new Error('Invalid media path');
    }
    return toLocalMediaUrl(filePath);
  });

  ipcMain.handle(IpcChannels.SELECT_IMAGE_EDIT_OUTPUT_FOLDER, async () => {
    if (!mainWindow) {
      return null;
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Image Edit Output Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle(IpcChannels.RESOLVE_IMAGE_EDIT_OUTPUT_FOLDER, (_event, folderPath: unknown) => {
    if (!isValidAbsolutePath(folderPath)) {
      throw new Error('Invalid folder path');
    }
    return resolveDefaultImageEditOutputFolder(folderPath);
  });

  ipcMain.handle(IpcChannels.LIST_IMAGE_EDIT_PRESETS, async () => {
    return getImageEditPresets();
  });

  ipcMain.handle(IpcChannels.SELECT_IMAGE_EDIT_PRESET_FOLDER, async () => {
    if (!mainWindow) {
      return null;
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Lightroom Preset Folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle(IpcChannels.IMPORT_IMAGE_EDIT_PRESETS, async (_event, folderPath: unknown) => {
    if (!isValidAbsolutePath(folderPath)) {
      throw new Error('Invalid preset folder');
    }
    presetPreviewCache.clear();
    return importImageEditPresets(folderPath);
  });

  ipcMain.handle(IpcChannels.PREVIEW_IMAGE_EDIT_PRESET, async (_event, presetId: unknown) => {
    if (typeof presetId !== 'string' || presetId.trim().length === 0) {
      throw new Error('Invalid preset');
    }
    const cached = presetPreviewCache.get(presetId);
    if (cached) {
      return cached;
    }
    const preset = await getImageEditPresetById(presetId);
    if (!preset) {
      throw new Error('Preset is no longer available');
    }
    const previewConfig = {
      ...DEFAULT_IMAGE_EDIT_CONFIG,
      canvas: {
        ...DEFAULT_IMAGE_EDIT_CONFIG.canvas,
        aspectRatio: '1:1' as const,
        top: { ...DEFAULT_IMAGE_EDIT_CONFIG.canvas.top },
        bottom: { ...DEFAULT_IMAGE_EDIT_CONFIG.canvas.bottom },
        left: { ...DEFAULT_IMAGE_EDIT_CONFIG.canvas.left },
        right: { ...DEFAULT_IMAGE_EDIT_CONFIG.canvas.right },
      },
      presetId: preset.id,
      presetName: preset.name,
      filter: preset.filter,
      tuning: {
        ...DEFAULT_IMAGE_EDIT_CONFIG.tuning,
        ...preset.tuning,
      },
      outputFormat: 'png' as const,
    };
    const previewDir = path.join(app.getPath('temp'), 'video-frame-generator-preset-previews');
    const previewFile = path.join(
      previewDir,
      `${crypto.createHash('sha1').update(presetId).digest('hex')}.png`,
    );
    await renderImagePreview(getImageEditPreviewSource(), previewFile, previewConfig, true);
    const dataUrl = `data:image/png;base64,${(await fs.readFile(previewFile)).toString('base64')}`;
    presetPreviewCache.set(presetId, dataUrl);
    return dataUrl;
  });

  ipcMain.handle(IpcChannels.START_IMAGE_EDIT_PREVIEW, async (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null) {
      throw new Error('Invalid image preview request');
    }
    const { imagePath, config } = request as { imagePath: unknown; config: unknown };
    if (!isValidAbsolutePath(imagePath)) {
      throw new Error('Select a preview image first');
    }
    if (imageEditingRunner.isRunning()) {
      throw new Error('Image editing is already running');
    }
    assertNoJobRunning('image-editing');
    void imageEditingRunner.startPreview({
      imagePath,
      config: sanitizeImageEditConfig(config),
    });
  });

  ipcMain.handle(IpcChannels.START_IMAGE_EDIT_BATCH, async (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null) {
      throw new Error('Invalid image edit request');
    }
    const { folderPath, images, outputFolder, config } = request as {
      folderPath: unknown;
      images: unknown;
      outputFolder: unknown;
      config: unknown;
    };
    if (!isValidAbsolutePath(folderPath)) {
      throw new Error('Invalid folder path');
    }
    if (!isImageFileArray(images)) {
      throw new Error('Invalid image list');
    }
    if (!isValidAbsolutePath(outputFolder)) {
      throw new Error('Invalid output folder');
    }
    if (path.resolve(outputFolder) === path.resolve(folderPath)) {
      throw new Error('Output folder must be different from the source folder');
    }
    if (imageEditingRunner.isRunning()) {
      throw new Error('Image editing is already running');
    }
    assertNoJobRunning('image-editing');
    void imageEditingRunner.startBatch({
      folderPath,
      images,
      outputFolder,
      config: sanitizeImageEditConfig(config),
    });
  });

  ipcMain.handle(IpcChannels.CANCEL_IMAGE_EDIT, () => {
    imageEditingRunner.cancel();
  });

  ipcMain.handle(IpcChannels.READ_IMAGE_EDIT_PREVIEW_FILE, async (_event, previewPath: unknown) => {
    if (!isValidAbsolutePath(previewPath)) {
      throw new Error('Invalid preview path');
    }
    const currentPreview = imageEditingRunner.getProgress().previewPath;
    if (!currentPreview || path.resolve(currentPreview) !== path.resolve(previewPath)) {
      throw new Error('Preview is no longer available');
    }
    return (await fs.readFile(previewPath)).toString('base64');
  });
}

function registerComposerHandlers(): void {
  ipcMain.handle(IpcChannels.SELECT_COMPOSER_VIDEOS, async () => {
    if (!mainWindow) {
      return [];
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Videos to Combine',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Videos',
          extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'],
        },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }
    return result.filePaths.map((filePath) => ({
      name: path.basename(filePath),
      path: path.normalize(filePath),
      extension: path.extname(filePath).replace('.', '').toLowerCase(),
    }));
  });

  ipcMain.handle(IpcChannels.SELECT_COMPOSER_AUDIO, async () => {
    if (!mainWindow) {
      return null;
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Audio Track',
      properties: ['openFile'],
      filters: [
        {
          name: 'Audio',
          extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'],
        },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return path.normalize(result.filePaths[0]);
  });

  ipcMain.handle(IpcChannels.RESOLVE_COMPOSER_OUTPUT_PATH, () => {
    return path.join(app.getPath('videos'), `combined-${Date.now()}.mp4`);
  });

  ipcMain.handle(IpcChannels.GENERATE_COMPOSER_THUMBNAILS, async (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null) {
      throw new Error('Invalid thumbnail request');
    }
    const { videoPaths } = request as { videoPaths: unknown };
    if (!Array.isArray(videoPaths) || !videoPaths.every(isValidAbsolutePath)) {
      throw new Error('Invalid video paths');
    }
    return composerRunner.importMedia(videoPaths);
  });

  ipcMain.handle(IpcChannels.GENERATE_COMPOSER_PREVIEW, async (_event, request: unknown) => {
    return composerRunner.generatePreview(request);
  });

  ipcMain.handle(IpcChannels.CANCEL_COMPOSER_PREVIEW, () => {
    composerRunner.cancelPreview();
  });

  ipcMain.handle(IpcChannels.PLAN_COMPOSER_TIMELINE, async (_event, request: unknown) => {
    if (composerRunner.isRunning()) {
      throw new Error('Video combiner is already running');
    }
    return composerRunner.planTimeline(request);
  });

  ipcMain.handle(IpcChannels.START_COMPOSER_EXPORT, async (_event, request: unknown) => {
    if (composerRunner.isRunning()) {
      throw new Error('Video combiner is already running');
    }
    assertNoJobRunning('composer');
    void composerRunner.startExport(request);
  });

  ipcMain.handle(IpcChannels.CANCEL_COMPOSER, () => {
    composerRunner.cancel();
  });

  ipcMain.handle(IpcChannels.PROBE_COMPOSER_VIDEO, async (_event, filePath: unknown) => {
    if (!isValidAbsolutePath(filePath)) {
      throw new Error('Invalid video path');
    }
    const info = await probeMediaFile(filePath);
    return {
      durationSeconds: info.durationSeconds,
      width: info.width,
      height: info.height,
      hasAudio: info.hasAudio,
    };
  });

  ipcMain.handle(IpcChannels.PROBE_COMPOSER_AUDIO, async (_event, filePath: unknown) => {
    if (!isValidAbsolutePath(filePath)) {
      throw new Error('Invalid audio path');
    }
    return getVideoDurationSeconds(filePath);
  });
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

app.whenReady().then(() => {
  // Local CLIP model cache under Electron userData (overridable via IMAGE_CLASSIFICATION_MODEL_CACHE).
  if (!process.env.IMAGE_CLASSIFICATION_MODEL_CACHE) {
    configureModelCacheDir(path.join(app.getPath('userData'), 'models'));
  } else {
    configureModelCacheDir(process.env.IMAGE_CLASSIFICATION_MODEL_CACHE);
  }

  registerIpcHandlers();
  protocol.handle('local-media', (request) => {
    const filePath = parseLocalMediaUrl(request.url);
    if (!path.isAbsolute(filePath)) {
      return new Response('Invalid media path', { status: 400 });
    }
    return net.fetch(pathToFileURL(filePath).href, { bypassCustomProtocolHandlers: true });
  });
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

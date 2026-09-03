import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_IMAGE_EDIT_CONFIG,
  INITIAL_IMAGE_EDIT_PROGRESS,
  type ImageEditConfig,
  type ImageEditPresetSummary,
  type ImageEditProgress,
} from '../../shared/imageEditing';
import type { ImageFile } from '../../shared/ipc';
import { createFreshImageEditConfig, mergeImageEditConfig } from '../utils/mergeSettingsConfig';
import { getInitialSettingsData } from '../utils/settingsProfileStorage';
import { useSettingsProfiles } from './useSettingsProfiles';

const imageEditDefaults = createFreshImageEditConfig();

export function useImageEditing(otherJobActive: boolean) {
  const [progress, setProgress] = useState<ImageEditProgress>({
    ...INITIAL_IMAGE_EDIT_PROGRESS,
    logs: [],
    failedFiles: [],
  });
  const [config, setConfig] = useState<ImageEditConfig>(() =>
    getInitialSettingsData('image-editor', imageEditDefaults, mergeImageEditConfig),
  );
  const settingsProfiles = useSettingsProfiles({
    workspaceId: 'image-editor',
    defaults: imageEditDefaults,
    mergeStored: mergeImageEditConfig,
    currentData: config,
    applyData: setConfig,
  });
  const [images, setImages] = useState<ImageFile[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [previewImagePath, setPreviewImagePath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<ImageEditPresetSummary[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [presetPreviewUrls, setPresetPreviewUrls] = useState<Record<string, string>>({});
  const [presetPreviewLoading, setPresetPreviewLoading] = useState<Record<string, boolean>>({});
  const presetPreviewUrlsRef = useRef<Record<string, string>>({});
  const presetPreviewAttemptedRef = useRef(new Set<string>());
  const [favoritePresetIds, setFavoritePresetIds] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem('image-edit-favorite-presets');
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  const previewUrlRef = useRef<string | null>(null);
  const loadedPreviewPath = useRef<string | null>(null);
  const lastPreviewSignature = useRef<string | null>(null);

  const replacePreviewUrl = useCallback((nextUrl: string | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return window.api.onImageEdit((event) => {
      setProgress(event.progress);
      if (event.type === 'image-edit-failed') {
        setError(event.progress.message);
      }
    });
  }, []);

  const refreshPresets = useCallback(async () => {
    setPresetsLoading(true);
    try {
      setPresets(await window.api.listImageEditPresets());
      setPresetsError(null);
    } catch (loadError) {
      setPresetsError(
        loadError instanceof Error ? loadError.message : 'Unable to load preset library',
      );
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPresets();
  }, [refreshPresets]);

  useEffect(() => {
    try {
      window.localStorage.setItem('image-edit-favorite-presets', JSON.stringify(favoritePresetIds));
    } catch {
      // Favorites are optional and should not affect image editing.
    }
  }, [favoritePresetIds]);

  useEffect(() => {
    const previewPath = progress.previewPath;
    if (
      !previewPath ||
      progress.status !== 'preview_ready' ||
      loadedPreviewPath.current === previewPath
    ) {
      return;
    }

    loadedPreviewPath.current = previewPath;
    let cancelled = false;
    void (async () => {
      try {
        const base64 = await window.api.readImageEditPreviewFile(previewPath);
        if (!cancelled) {
          replacePreviewUrl(`data:image/png;base64,${base64}`);
        }
      } catch (readError) {
        if (!cancelled) {
          setError(readError instanceof Error ? readError.message : 'Unable to load image preview');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [progress.previewPath, progress.status, replacePreviewUrl]);

  const updateConfig = useCallback((patch: Partial<ImageEditConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
  }, []);

  const updateCanvas = useCallback((patch: Partial<ImageEditConfig['canvas']>) => {
    setConfig((current) => ({ ...current, canvas: { ...current.canvas, ...patch } }));
  }, []);

  const updateSideImage = useCallback(
    (side: 'top' | 'bottom' | 'left' | 'right', patch: Partial<ImageEditConfig['canvas']['top']>) => {
      setConfig((current) => ({
        ...current,
        canvas: {
          ...current.canvas,
          [side]: { ...current.canvas[side], ...patch },
        },
      }));
    },
    [],
  );

  const updateTuning = useCallback((patch: Partial<ImageEditConfig['tuning']>) => {
    setConfig((current) => ({ ...current, tuning: { ...current.tuning, ...patch } }));
  }, []);

  const updateWatermark = useCallback((patch: Partial<ImageEditConfig['watermark']>) => {
    setConfig((current) => ({ ...current, watermark: { ...current.watermark, ...patch } }));
  }, []);

  const applyPreset = useCallback((preset: ImageEditPresetSummary) => {
    setConfig((current) => ({
      ...current,
      presetId: preset.id,
      presetName: preset.name,
      filter: preset.filter,
      tuning: {
        ...DEFAULT_IMAGE_EDIT_CONFIG.tuning,
        ...preset.tuning,
      },
    }));
    setError(null);
  }, []);

  const togglePresetFavorite = useCallback((presetId: string) => {
    setFavoritePresetIds((current) =>
      current.includes(presetId)
        ? current.filter((id) => id !== presetId)
        : [...current, presetId],
    );
  }, []);

  const loadPresetPreview = useCallback(async (presetId: string) => {
    if (
      presetPreviewUrlsRef.current[presetId] ||
      presetPreviewAttemptedRef.current.has(presetId)
    ) {
      return;
    }
    presetPreviewAttemptedRef.current.add(presetId);
    setPresetPreviewLoading((current) => ({ ...current, [presetId]: true }));
    try {
      const dataUrl = await window.api.previewImageEditPreset(presetId);
      presetPreviewUrlsRef.current[presetId] = dataUrl;
      setPresetPreviewUrls((current) => ({ ...current, [presetId]: dataUrl }));
    } catch {
      // A single unavailable thumbnail should not interrupt the preset browser.
    } finally {
      setPresetPreviewLoading((current) => ({ ...current, [presetId]: false }));
    }
  }, []);

  const importPresets = useCallback(async () => {
    const folderPath = await window.api.selectImageEditPresetFolder();
    if (!folderPath) {
      return;
    }
    setPresetsLoading(true);
    setPresetsError(null);
    try {
      setPresets(await window.api.importImageEditPresets(folderPath));
      presetPreviewUrlsRef.current = {};
      presetPreviewAttemptedRef.current.clear();
      setPresetPreviewUrls({});
    } catch (importError) {
      setPresetsError(
        importError instanceof Error ? importError.message : 'Unable to import presets',
      );
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  const selectFolder = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const selected = await window.api.selectFolder();
      if (!selected) {
        return;
      }
      const result = await window.api.scanImages(selected);
      const defaultOutput = await window.api.resolveImageEditOutputFolder(selected);
      setFolder(result.folder);
      setImages(result.images);
      setOutputFolder(defaultOutput);
      setPreviewImagePath(result.images[0]?.path ?? null);
      replacePreviewUrl(null);
      loadedPreviewPath.current = null;
      lastPreviewSignature.current = null;
      setProgress({
        ...INITIAL_IMAGE_EDIT_PROGRESS,
        logs: [],
        failedFiles: [],
        selectedFolder: result.folder,
        outputFolder: defaultOutput,
        totalImages: result.images.length,
        status: result.images.length > 0 ? 'ready' : 'no_images',
        message:
          result.images.length > 0
            ? `Found ${result.images.length} image${result.images.length === 1 ? '' : 's'}.`
            : 'No supported images found in the selected folder.',
      });
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Unable to scan images');
    } finally {
      setBusy(false);
    }
  }, [replacePreviewUrl]);

  const selectWatermark = useCallback(async () => {
    const selected = await window.api.selectBrandingLogo();
    if (selected) {
      updateWatermark({ enabled: true, imagePath: selected });
    }
  }, [updateWatermark]);

  const selectSideImage = useCallback(
    async (side: 'top' | 'bottom' | 'left' | 'right') => {
      const selected = await window.api.selectBrandingLogo();
      if (selected) {
        updateSideImage(side, { enabled: true, imagePath: selected });
      }
    },
    [updateSideImage],
  );

  const selectOutputFolder = useCallback(async () => {
    const selected = await window.api.selectImageEditOutputFolder();
    if (selected) {
      setOutputFolder(selected);
    }
  }, []);

  const resetOutputFolder = useCallback(async () => {
    if (folder) {
      setOutputFolder(await window.api.resolveImageEditOutputFolder(folder));
    }
  }, [folder]);

  const isEditing = progress.status === 'previewing' || progress.status === 'processing';
  const sideImages = [config.canvas.top, config.canvas.bottom, config.canvas.left, config.canvas.right];
  const hasAdjustment =
    config.presetId !== null ||
    config.filter !== 'none' ||
    Object.values(config.tuning).some((value) => value !== 0) ||
    config.watermark.enabled ||
    sideImages.some((side) => side.enabled) ||
    config.canvas.aspectRatio !== 'source' ||
    config.canvas.zoomPercent !== 100 ||
    config.cropMode !== 'cover' ||
    config.outputFormat !== DEFAULT_IMAGE_EDIT_CONFIG.outputFormat ||
    config.qualityPercent !== DEFAULT_IMAGE_EDIT_CONFIG.qualityPercent;
  const watermarkMissing = config.watermark.enabled && !config.watermark.imagePath;
  const sideImageMissing = sideImages.some((side) => side.enabled && !side.imagePath);
  const configReady = hasAdjustment && !watermarkMissing && !sideImageMissing;
  const previewSignature = JSON.stringify({ imagePath: previewImagePath, config });

  const startPreviewRender = useCallback(
    async (signature: string) => {
      if (!previewImagePath) {
        return;
      }
      lastPreviewSignature.current = signature;
      setError(null);
      replacePreviewUrl(null);
      loadedPreviewPath.current = null;
      try {
        await window.api.startImageEditPreview({ imagePath: previewImagePath, config });
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : 'Unable to start image preview');
      }
    },
    [config, previewImagePath, replacePreviewUrl],
  );

  useEffect(() => {
    if (
      !previewImagePath ||
      !configReady ||
      busy ||
      otherJobActive ||
      isEditing ||
      lastPreviewSignature.current === previewSignature
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void startPreviewRender(previewSignature);
    }, 500);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    busy,
    configReady,
    isEditing,
    otherJobActive,
    previewImagePath,
    previewSignature,
    startPreviewRender,
  ]);

  const generatePreview = useCallback(async () => {
    if (previewImagePath) {
      await startPreviewRender(previewSignature);
    }
  }, [previewImagePath, previewSignature, startPreviewRender]);

  const applyToAll = useCallback(async () => {
    if (!folder || !outputFolder || images.length === 0) {
      return;
    }
    setError(null);
    try {
      await window.api.startImageEditBatch({ folderPath: folder, images, outputFolder, config });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to start image editing');
    }
  }, [config, folder, images, outputFolder]);

  const cancel = useCallback(async () => {
    await window.api.cancelImageEdit();
  }, []);

  const idle = !isEditing && !busy && !otherJobActive;

  return {
    progress,
    config,
    settingsProfiles,
    presets,
    presetsLoading,
    presetsError,
    presetPreviewUrls,
    presetPreviewLoading,
    favoritePresetIds,
    images,
    folder,
    outputFolder,
    previewImagePath,
    previewUrl,
    busy,
    error,
    isEditing,
    configReady,
    canSelectFolder: idle,
    canPreview: idle && configReady && Boolean(previewImagePath),
    canApply: idle && configReady && images.length > 0 && Boolean(outputFolder),
    canCancel: isEditing,
    setPreviewImagePath,
    updateConfig,
    updateCanvas,
    updateSideImage,
    updateTuning,
    updateWatermark,
    applyPreset,
    togglePresetFavorite,
    loadPresetPreview,
    importPresets,
    selectFolder,
    selectWatermark,
    selectSideImage,
    selectOutputFolder,
    resetOutputFolder,
    generatePreview,
    applyToAll,
    cancel,
  };
}

export type ImageEditingController = ReturnType<typeof useImageEditing>;

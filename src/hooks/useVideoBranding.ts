import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_BRANDING_CONFIG,
  INITIAL_BRANDING_PROGRESS,
  type BrandingConfig,
  type BrandingCanvasConfig,
  type BrandingImagePresetConfig,
  type BrandingProgress,
  type BrandingSide,
  type BrandingSubtitlesConfig,
  type MovingTextConfig,
  type SideImageConfig,
  type WatermarkConfig,
} from '../../shared/branding';
import type { VideoFile } from '../../shared/ipc';

export function useVideoBranding(otherJobActive: boolean) {
  const [progress, setProgress] = useState<BrandingProgress>({
    ...INITIAL_BRANDING_PROGRESS,
    logs: [],
    failedFiles: [],
  });
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT_BRANDING_CONFIG);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [previewVideoPath, setPreviewVideoPath] = useState<string | null>(null);
  const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showEncodedPreview, setShowEncodedPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return window.api.onBranding((event) => {
      startTransition(() => {
        setProgress(event.progress);
      });
      if (event.type === 'branding-failed') {
        setError(event.progress.message);
      }
    });
  }, []);

  useEffect(() => {
    if (!previewVideoPath) {
      setSourceVideoUrl(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const url = await window.api.getLocalMediaUrl(previewVideoPath);
        if (!cancelled) {
          setSourceVideoUrl(url);
        }
      } catch {
        if (!cancelled) {
          setSourceVideoUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewVideoPath]);

  // Load the encoded FFmpeg preview clip when the user explicitly requests it.
  useEffect(() => {
    const path = progress.previewPath;
    if (!path || progress.status !== 'preview_ready' || loadedPreviewPath.current === path) {
      return;
    }

    loadedPreviewPath.current = path;
    let cancelled = false;

    void (async () => {
      try {
        const bytes = await window.api.readBrandingPreviewFile(path);
        if (cancelled) {
          return;
        }
        const blob = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });
        replacePreviewUrl(URL.createObjectURL(blob));
        setShowEncodedPreview(true);
      } catch (readError) {
        if (!cancelled) {
          setError(readError instanceof Error ? readError.message : 'Unable to load preview');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [progress.previewPath, progress.status, replacePreviewUrl]);

  const updateWatermark = useCallback((patch: Partial<WatermarkConfig>) => {
    setConfig((current) => ({ ...current, watermark: { ...current.watermark, ...patch } }));
  }, []);

  const updateWatermarkText = useCallback((patch: Partial<WatermarkConfig['text']>) => {
    setConfig((current) => ({
      ...current,
      watermark: { ...current.watermark, text: { ...current.watermark.text, ...patch } },
    }));
  }, []);

  const updateMovingText = useCallback((patch: Partial<MovingTextConfig>) => {
    setConfig((current) => ({ ...current, movingText: { ...current.movingText, ...patch } }));
  }, []);

  const updateCanvas = useCallback((patch: Partial<BrandingCanvasConfig>) => {
    setConfig((current) => ({ ...current, canvas: { ...current.canvas, ...patch } }));
  }, []);

  const updateSideImage = useCallback(
    (side: BrandingSide, patch: Partial<SideImageConfig>) => {
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

  const updateImagePreset = useCallback((next: BrandingImagePresetConfig) => {
    setConfig((current) => ({ ...current, imagePreset: next }));
  }, []);

  const updateSubtitles = useCallback((patch: Partial<BrandingSubtitlesConfig>) => {
    setConfig((current) => ({
      ...current,
      subtitles: { ...current.subtitles, ...patch },
    }));
  }, []);

  const selectFolder = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const selected = await window.api.selectFolder();
      if (!selected) {
        return;
      }
      const result = await window.api.scanClassificationFolder(selected);
      const defaultOutput = await window.api.resolveBrandingOutputFolder(selected);

      setFolder(result.folder);
      setVideos(result.videos);
      setOutputFolder(defaultOutput);
      setPreviewVideoPath(result.videos[0]?.path ?? null);
      replacePreviewUrl(null);
      setShowEncodedPreview(false);
      loadedPreviewPath.current = null;
      setProgress({
        ...INITIAL_BRANDING_PROGRESS,
        logs: [],
        failedFiles: [],
        selectedFolder: result.folder,
        outputFolder: defaultOutput,
        totalVideos: result.videos.length,
        status: result.videos.length > 0 ? 'ready' : 'no_videos',
        message:
          result.videos.length > 0
            ? `Found ${result.videos.length} video${result.videos.length === 1 ? '' : 's'}.`
            : 'No supported videos found in the selected folder.',
      });
    } finally {
      setBusy(false);
    }
  }, [replacePreviewUrl]);

  const selectLogo = useCallback(async () => {
    const selected = await window.api.selectBrandingLogo();
    if (selected) {
      updateWatermark({ imagePath: selected, mode: 'image', enabled: true });
    }
  }, [updateWatermark]);

  const selectSideImage = useCallback(
    async (side: BrandingSide) => {
      const selected = await window.api.selectBrandingLogo();
      if (selected) {
        updateSideImage(side, { imagePath: selected, enabled: true });
      }
    },
    [updateSideImage],
  );

  const selectOutputFolder = useCallback(async () => {
    const selected = await window.api.selectBrandingOutputFolder();
    if (selected) {
      setOutputFolder(selected);
    }
  }, []);

  const resetOutputFolder = useCallback(async () => {
    if (!folder) {
      return;
    }
    setOutputFolder(await window.api.resolveBrandingOutputFolder(folder));
  }, [folder]);

  const isBranding = progress.status === 'processing' || progress.status === 'previewing';
  const sideImagesEnabled = [
    config.canvas.top,
    config.canvas.bottom,
    config.canvas.left,
    config.canvas.right,
  ].some((side) => side.enabled);
  const canvasEnabled =
    sideImagesEnabled || config.canvas.aspectRatio !== 'source' || config.canvas.zoomPercent !== 100;
  const brandingEnabled =
    config.watermark.enabled ||
    config.movingText.enabled ||
    canvasEnabled ||
    Boolean(config.imagePreset?.enabled && config.imagePreset.presetId) ||
    Boolean(config.subtitles?.enabled);
  const logoMissing =
    config.watermark.enabled && config.watermark.mode === 'image' && !config.watermark.imagePath;
  const sideImageMissing = [
    config.canvas.top,
    config.canvas.bottom,
    config.canvas.left,
    config.canvas.right,
  ].some((side) => side.enabled && !side.imagePath);
  const configReady = brandingEnabled && !logoMissing && !sideImageMissing;
  const previewSignature = JSON.stringify({ videoPath: previewVideoPath, config });

  const startPreviewRender = useCallback(
    async (signature: string) => {
      if (!previewVideoPath) {
        return;
      }
      lastPreviewSignature.current = signature;
      setError(null);
      replacePreviewUrl(null);
      loadedPreviewPath.current = null;
      try {
        await window.api.startBrandingPreview({ videoPath: previewVideoPath, config });
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : 'Unable to start preview');
      }
    },
    [previewVideoPath, config, replacePreviewUrl],
  );

  const generatePreview = useCallback(async () => {
    if (!previewVideoPath) {
      return;
    }
    await startPreviewRender(previewSignature);
  }, [previewVideoPath, previewSignature, startPreviewRender]);

  const showInstantPreview = Boolean(sourceVideoUrl) && configReady && !showEncodedPreview;

  const applyToAll = useCallback(async () => {
    if (!folder || !outputFolder || videos.length === 0) {
      return;
    }
    setError(null);
    try {
      await window.api.startBrandingBatch({ folderPath: folder, videos, outputFolder, config });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to start branding');
    }
  }, [folder, outputFolder, videos, config]);

  const cancel = useCallback(async () => {
    await window.api.cancelBranding();
  }, []);

  const idle = !isBranding && !busy && !otherJobActive;

  return {
    progress,
    config,
    videos,
    folder,
    outputFolder,
    previewVideoPath,
    sourceVideoUrl,
    previewUrl,
    showInstantPreview,
    showEncodedPreview,
    busy,
    error,
    isBranding,
    configReady,
    canSelectFolder: idle,
    canPreview: idle && configReady && Boolean(previewVideoPath),
    canApply: idle && configReady && videos.length > 0 && Boolean(outputFolder),
    canCancel: isBranding,
    setPreviewVideoPath,
    updateWatermark,
    updateWatermarkText,
    updateMovingText,
    updateCanvas,
    updateSideImage,
    updateImagePreset,
    updateSubtitles,
    selectFolder,
    selectLogo,
    selectSideImage,
    selectOutputFolder,
    resetOutputFolder,
    generatePreview,
    applyToAll,
    cancel,
  };
}

export type VideoBrandingController = ReturnType<typeof useVideoBranding>;

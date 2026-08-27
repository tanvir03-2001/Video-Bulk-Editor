import { useCallback, useEffect, useState } from 'react';
import type {
  ImageClassificationProgress,
  ImageFile,
  VideoFile,
} from '../../shared/ipc';
import { INITIAL_IMAGE_CLASSIFICATION_PROGRESS } from '../../shared/ipc';

/** Matches DEFAULT_ALLOW_PERCENT in classificationConfig (0.25 thresholds). */
export const DEFAULT_ALLOW_PERCENT = 25;

function buildReadyMessage(imageCount: number, videoCount: number): string {
  const parts: string[] = [];
  if (imageCount > 0) {
    parts.push(`${imageCount} image${imageCount === 1 ? '' : 's'}`);
  }
  if (videoCount > 0) {
    parts.push(`${videoCount} video${videoCount === 1 ? '' : 's'}`);
  }
  if (parts.length === 0) {
    return 'No image or video files found in the selected folder.';
  }
  return `Found ${parts.join(' and ')}. Use Classify Image or Classify Video.`;
}

function clampAllowPercent(value: number): number {
  const stepped = Math.round(value / 5) * 5;
  return Math.max(5, Math.min(90, stepped));
}

export function useImageClassification(videoProcessingActive: boolean) {
  const [progress, setProgress] = useState<ImageClassificationProgress>({
    ...INITIAL_IMAGE_CLASSIFICATION_PROGRESS,
    logs: [],
  });
  const [images, setImages] = useState<ImageFile[]>([]);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [allowPercent, setAllowPercentState] = useState(DEFAULT_ALLOW_PERCENT);

  useEffect(() => {
    return window.api.onImageClassification((event) => {
      setProgress(event.progress);
    });
  }, []);

  const setAllowPercent = useCallback((value: number) => {
    setAllowPercentState(clampAllowPercent(value));
  }, []);

  const selectImageFolder = useCallback(async () => {
    setBusy(true);
    try {
      const folder = await window.api.selectFolder();
      if (!folder) {
        return;
      }
      const result = await window.api.scanClassificationFolder(folder);
      setImages(result.images);
      setVideos(result.videos);
      const hasMedia = result.images.length > 0 || result.videos.length > 0;
      setProgress({
        ...INITIAL_IMAGE_CLASSIFICATION_PROGRESS,
        selectedFolder: result.folder,
        imageCount: result.images.length,
        videoCount: result.videos.length,
        status: hasMedia ? 'ready' : 'no_images',
        message: buildReadyMessage(result.images.length, result.videos.length),
        logs: [],
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const canRunBase =
    !busy &&
    !videoProcessingActive &&
    Boolean(progress.selectedFolder) &&
    (progress.status === 'ready' ||
      progress.status === 'completed' ||
      progress.status === 'cancelled');

  const startClassifyImages = useCallback(async () => {
    if (!progress.selectedFolder || images.length === 0) {
      return;
    }
    await window.api.startImageClassification({
      folderPath: progress.selectedFolder,
      imageCount: images.length,
      videos: [],
      allowPercent,
    });
  }, [progress.selectedFolder, images.length, allowPercent]);

  const startClassifyVideos = useCallback(async () => {
    if (!progress.selectedFolder || videos.length === 0) {
      return;
    }
    await window.api.startImageClassification({
      folderPath: progress.selectedFolder,
      imageCount: 0,
      videos,
      allowPercent,
    });
  }, [progress.selectedFolder, videos, allowPercent]);

  const cancelClassification = useCallback(async () => {
    await window.api.cancelImageClassification();
  }, []);

  const isClassifying = progress.status === 'classifying';
  const canClassifyImages = canRunBase && !isClassifying && images.length > 0;
  const canClassifyVideos = canRunBase && !isClassifying && videos.length > 0;
  const canCancel = isClassifying;
  const canSelectFolder = !isClassifying && !busy && !videoProcessingActive;

  return {
    progress,
    images,
    videos,
    busy,
    allowPercent,
    setAllowPercent,
    isClassifying,
    canClassifyImages,
    canClassifyVideos,
    canCancel,
    canSelectFolder,
    selectImageFolder,
    startClassifyImages,
    startClassifyVideos,
    cancelClassification,
  };
}

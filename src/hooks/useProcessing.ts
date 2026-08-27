import { useCallback, useEffect, useState } from 'react';
import type { ProcessingProgress, VideoFile } from '../types/processing';
import { INITIAL_PROGRESS } from '../types/processing';

/** Matches DEFAULT_ALLOW_PERCENT in classificationConfig. */
export const DEFAULT_ALLOW_PERCENT = 25;

function clampAllowPercent(value: number): number {
  const stepped = Math.round(value / 5) * 5;
  return Math.max(5, Math.min(90, stepped));
}

export function useProcessing() {
  const [progress, setProgress] = useState<ProcessingProgress>({
    ...INITIAL_PROGRESS,
    logs: [],
  });
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [allowPercent, setAllowPercentState] = useState(DEFAULT_ALLOW_PERCENT);

  const setAllowPercent = useCallback((value: number) => {
    setAllowPercentState(clampAllowPercent(value));
  }, []);

  useEffect(() => {
    const unsubscribe = window.api.onProgress((event) => {
      setProgress(event.progress);
    });

    void window.api.checkFfmpeg().then((status) => {
      setProgress((prev) => ({
        ...prev,
        ffmpegAvailable: status.available,
        ffmpegError: status.error,
      }));
    });

    return unsubscribe;
  }, []);

  const selectFolder = useCallback(async () => {
    setBusy(true);
    try {
      const folder = await window.api.selectFolder();
      if (!folder) {
        return;
      }
      const result = await window.api.scanVideos(folder);
      setVideos(result.videos);
      setProgress((prev) => ({
        ...prev,
        selectedFolder: result.folder,
        totalVideos: result.videos.length,
        completedVideos: 0,
        remainingVideos: result.videos.length,
        failedVideos: 0,
        imagesGenerated: 0,
        currentFile: null,
        currentImageIndex: 0,
        currentImageTotal: 0,
        progressPercent: 0,
        elapsedMs: 0,
        status: result.videos.length > 0 ? 'ready' : 'no_videos',
        message:
          result.videos.length > 0
            ? `Found ${result.videos.length} video file${result.videos.length === 1 ? '' : 's'}. Ready to process.`
            : 'No video files found in the selected folder.',
        logs: [],
      }));
    } finally {
      setBusy(false);
    }
  }, []);

  const startProcessing = useCallback(async () => {
    if (!progress.selectedFolder || videos.length === 0) {
      return;
    }
    await window.api.startProcessing({
      folderPath: progress.selectedFolder,
      videos,
      allowPercent,
    });
  }, [progress.selectedFolder, videos, allowPercent]);

  const cancelProcessing = useCallback(async () => {
    await window.api.cancelProcessing();
  }, []);

  const isProcessing = progress.status === 'processing';
  const canStart =
    !isProcessing &&
    !busy &&
    progress.ffmpegAvailable &&
    Boolean(progress.selectedFolder) &&
    videos.length > 0 &&
    (progress.status === 'ready' ||
      progress.status === 'completed' ||
      progress.status === 'cancelled');
  const canCancel = isProcessing;

  return {
    progress,
    videos,
    busy,
    allowPercent,
    setAllowPercent,
    isProcessing,
    canStart,
    canCancel,
    selectFolder,
    startProcessing,
    cancelProcessing,
  };
}

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COMPOSER_AUDIO_DELAY_SECONDS,
  COMPOSER_DEFAULT_VOLUME_PERCENT,
  COMPOSER_PIPELINE_STEPS,
  COMPOSER_STEP_TOTAL,
  COMPOSER_TRANSITION_SECONDS,
  INITIAL_COMPOSER_PROGRESS,
  type ComposerClip,
  type ComposerMode,
  type ComposerProgress,
} from '../../shared/composer';
import {
  hasAnyBrandingEnabled,
  validateBrandingConfig,
  type BrandingCanvasConfig,
  type BrandingConfig,
  type BrandingImagePresetConfig,
  type BrandingSide,
  type BrandingSubtitlesConfig,
  type MovingTextConfig,
  type WatermarkConfig,
} from '../../shared/branding';
import type { LogEntry } from '../../shared/ipc';
import { mergeBrandingConfig } from '../utils/mergeSettingsConfig';
import { getInitialSettingsData } from '../utils/settingsProfileStorage';
import { loadComposerPrefs, saveComposerMode } from '../utils/composerPrefsStorage';
import { useSettingsProfiles } from './useSettingsProfiles';
import { createDefaultComposerBranding } from '../../shared/composer';

export interface ComposerVideoItem {
  path: string;
  name: string;
  extension: string;
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

const composerBrandingDefaults = createDefaultComposerBranding();

export function useVideoComposer(otherJobActive: boolean) {
  const [progress, setProgress] = useState<ComposerProgress>({
    ...INITIAL_COMPOSER_PROGRESS,
    logs: [],
  });
  const [videos, setVideos] = useState<ComposerVideoItem[]>([]);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(0);
  const [composerMode, setComposerMode] = useState<ComposerMode>(
    () => loadComposerPrefs().composerMode,
  );
  const [customDurationSeconds, setCustomDurationSeconds] = useState<number | null>(null);
  const [padImagePath, setPadImagePath] = useState<string | null>(null);
  const [clips, setClips] = useState<ComposerClip[]>([]);
  const [branding, setBranding] = useState<BrandingConfig>(() =>
    getInitialSettingsData('composer', composerBrandingDefaults, mergeBrandingConfig),
  );
  const settingsProfiles = useSettingsProfiles({
    workspaceId: 'composer',
    defaults: composerBrandingDefaults,
    mergeStored: mergeBrandingConfig,
    currentData: branding,
    applyData: setBranding,
  });
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState('combined');
  const [thumbnails, setThumbnails] = useState<Record<string, string[]>>({});
  const [proxyPaths, setProxyPaths] = useState<Record<string, string>>({});
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [timelinePlanned, setTimelinePlanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activityMessage, setActivityMessage] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<LogEntry[]>([]);
  const [exportedOutputPath, setExportedOutputPath] = useState<string | null>(null);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(28);

  const pushActivity = useCallback((level: LogEntry['level'], message: string) => {
    setActivityLogs((current) => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        level,
        message,
      };
      const next = [...current, entry];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    setActivityMessage(message);
  }, []);

  const setStepActivity = useCallback(
    (stepIndex: number, message: string) => {
      const stepLabel = COMPOSER_PIPELINE_STEPS[stepIndex - 1];
      const nextStepLabel =
        stepIndex < COMPOSER_STEP_TOTAL ? COMPOSER_PIPELINE_STEPS[stepIndex] : null;
      const formatted = nextStepLabel
        ? `Step ${stepIndex}/${COMPOSER_STEP_TOTAL} — ${stepLabel} · Next: ${nextStepLabel}`
        : `Step ${stepIndex}/${COMPOSER_STEP_TOTAL} — ${stepLabel}`;
      pushActivity('info', `${formatted} — ${message}`);
    },
    [pushActivity],
  );

  useEffect(() => {
    return window.api.onComposer((event) => {
      startTransition(() => {
        setProgress(event.progress);
      });
      if (event.progress.message) {
        const stepPrefix =
          event.progress.stepIndex > 0
            ? `Step ${event.progress.stepIndex}/${event.progress.stepTotal}`
            : null;
        setActivityMessage(
          stepPrefix
            ? `${stepPrefix} — ${event.progress.message}`
            : event.progress.message,
        );
      }
      if (event.type === 'composer-failed') {
        setError(event.progress.message);
      }
      if (event.type === 'composer-completed' && event.progress.outputPath) {
        setExportedOutputPath(event.progress.outputPath);
        pushActivity('success', `Export complete — ${event.progress.outputPath}`);
      }
    });
  }, [pushActivity]);

  const outputPath = useMemo(() => {
    if (!outputFolder) {
      return null;
    }
    return joinOutputPath(outputFolder, outputFileName);
  }, [outputFolder, outputFileName]);

  const applyResolvedOutputPath = useCallback((resolved: string) => {
    const parsed = parseOutputPath(resolved);
    setOutputFolder(parsed.folder);
    setOutputFileName(parsed.fileName);
  }, []);

  const naturalVideoDurationSeconds = useMemo(
    () => videos.reduce((sum, video) => sum + Math.max(0.1, video.durationSeconds), 0),
    [videos],
  );

  const targetDurationSeconds = useMemo(() => {
    if (composerMode === 'video-only') {
      if (
        customDurationSeconds !== null &&
        customDurationSeconds > naturalVideoDurationSeconds
      ) {
        return customDurationSeconds;
      }
      return naturalVideoDurationSeconds;
    }
    return audioDurationSeconds > 0 ? COMPOSER_AUDIO_DELAY_SECONDS + audioDurationSeconds : 0;
  }, [audioDurationSeconds, composerMode, customDurationSeconds, naturalVideoDurationSeconds]);

  const placedDuration = useMemo(
    () => clips.reduce((sum, clip) => sum + clip.durationSeconds, 0),
    [clips],
  );

  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === selectedClipId) ?? clips[0] ?? null,
    [clips, selectedClipId],
  );

  const previewDurationSeconds = useMemo(() => {
    if (targetDurationSeconds > 0) {
      return targetDurationSeconds;
    }
    return Math.max(placedDuration, 1);
  }, [placedDuration, targetDurationSeconds]);

  const previewDimensions = useMemo(() => {
    const firstVideo = videos[0];
    if (firstVideo && firstVideo.width > 0 && firstVideo.height > 0) {
      return { width: firstVideo.width, height: firstVideo.height };
    }
    return { width: 16, height: 9 };
  }, [videos]);

  const buildInitialClips = useCallback((items: ComposerVideoItem[]): ComposerClip[] => {
    let offset = 0;
    return items.map((video) => {
      const durationSeconds = Math.max(0.1, video.durationSeconds);
      const clip: ComposerClip = {
        id: crypto.randomUUID(),
        sourcePath: video.path,
        sourceName: video.name,
        startSeconds: 0,
        durationSeconds,
        timelineOffset: offset,
        volumePercent: COMPOSER_DEFAULT_VOLUME_PERCENT,
        muted: false,
        isFiller: false,
      };
      offset += durationSeconds;
      return clip;
    });
  }, []);

  const planTimeline = useCallback(
    async (
      items: ComposerVideoItem[],
      nextClips: ComposerClip[],
      duration: number,
      options?: {
        mode?: ComposerMode;
        customDuration?: number | null;
        padImage?: string | null;
      },
    ) => {
      const mode = options?.mode ?? composerMode;
      setStepActivity(4, 'Planning timeline…');
      const planned = await window.api.planComposerTimeline({
        videos: items,
        audioDurationSeconds: mode === 'video-only' ? 0 : duration,
        clips: nextClips,
        mode,
        customDurationSeconds: options?.customDuration ?? customDurationSeconds,
        padImagePath: options?.padImage ?? padImagePath,
      });
      setClips(planned.clips);
      setTimelinePlanned(true);
      setStepActivity(4, `Timeline ready (${planned.clips.length} clips)`);
      return planned;
    },
    [composerMode, customDurationSeconds, padImagePath, setStepActivity],
  );

  const videosRef = useRef(videos);
  const clipsRef = useRef(clips);
  videosRef.current = videos;
  clipsRef.current = clips;

  const importEnrichedVideos = useCallback(
    async (enriched: ComposerVideoItem[]) => {
      if (enriched.length === 0) {
        return;
      }

      const currentVideos = videosRef.current;
      const currentClips = clipsRef.current;

      const nextVideos = [...currentVideos];
      for (const video of enriched) {
        if (!nextVideos.some((existing) => existing.path === video.path)) {
          nextVideos.push(video);
        }
      }
      videosRef.current = nextVideos;
      setVideos(nextVideos);

      // Keep already-placed videos first; append new ones in pick order.
      const existingPrimary = currentClips
        .filter((clip) => !clip.isFiller && !clip.isPadImage)
        .sort((a, b) => a.timelineOffset - b.timelineOffset);
      const existingPaths = new Set(existingPrimary.map((clip) => clip.sourcePath));
      const newlyAdded = enriched.filter((video) => !existingPaths.has(video.path));
      if (newlyAdded.length === 0) {
        pushActivity('info', 'Selected video is already in the project');
        return;
      }

      let offset =
        existingPrimary.length > 0
          ? existingPrimary[existingPrimary.length - 1].timelineOffset +
            existingPrimary[existingPrimary.length - 1].durationSeconds
          : 0;
      const appended = newlyAdded.map((video) => {
        const durationSeconds = Math.max(0.1, video.durationSeconds);
        const clip: ComposerClip = {
          id: crypto.randomUUID(),
          sourcePath: video.path,
          sourceName: video.name,
          startSeconds: 0,
          durationSeconds,
          timelineOffset: offset,
          volumePercent: COMPOSER_DEFAULT_VOLUME_PERCENT,
          muted: false,
          isFiller: false,
        };
        offset += durationSeconds;
        return clip;
      });
      const nextClips =
        existingPrimary.length > 0 || appended.length > 0
          ? [...existingPrimary, ...appended]
          : buildInitialClips(nextVideos);
      clipsRef.current = nextClips;
      setClips(nextClips);
      setSelectedClipId((current) => current ?? nextClips[0]?.id ?? null);
      if (!outputFolder) {
        applyResolvedOutputPath(await window.api.resolveComposerOutputPath());
      }

      setStepActivity(2, `Generating thumbnails & proxy for ${newlyAdded.length} video(s)…`);
      const media = await window.api.generateComposerThumbnails({
        videoPaths: newlyAdded.map((video) => video.path),
      });
      setThumbnails((current) => ({ ...current, ...media.thumbnails }));
      setProxyPaths((current) => ({ ...current, ...media.proxies }));
      pushActivity('success', `Added ${newlyAdded.map((video) => video.name).join(', ')}`);

      if (composerMode === 'video-only') {
        await planTimeline(nextVideos, nextClips, 0, { mode: 'video-only' });
      } else if (audioPath && audioDurationSeconds > 0) {
        await planTimeline(nextVideos, nextClips, audioDurationSeconds);
      }
    },
    [
      applyResolvedOutputPath,
      audioDurationSeconds,
      audioPath,
      buildInitialClips,
      composerMode,
      outputFolder,
      planTimeline,
      pushActivity,
      setStepActivity,
    ],
  );

  const addVideos = useCallback(async () => {
    setBusy(true);
    setError(null);
    setTimelinePlanned(false);
    let addedCount = 0;
    try {
      // One file per dialog so pick order = timeline order (Windows multi-select is A–Z).
      while (true) {
        setStepActivity(
          1,
          addedCount === 0
            ? 'Selecting video…'
            : `Select next video (${addedCount} added — Cancel when done)…`,
        );
        const selected = await window.api.selectComposerVideos();
        if (selected.length === 0) {
          if (addedCount === 0) {
            setActivityMessage(null);
          } else {
            pushActivity('info', `Finished adding ${addedCount} video${addedCount === 1 ? '' : 's'}`);
          }
          break;
        }

        const video = selected[0];
        setStepActivity(1, `Reading ${video.name}…`);
        const info = await window.api.probeComposerVideo(video.path);
        await importEnrichedVideos([
          {
            ...video,
            durationSeconds: info.durationSeconds,
            width: info.width,
            height: info.height,
            hasAudio: info.hasAudio,
          },
        ]);
        addedCount += 1;
      }
    } catch (selectError) {
      const message = selectError instanceof Error ? selectError.message : 'Unable to add videos';
      setError(message);
      pushActivity('error', message);
    } finally {
      setBusy(false);
    }
  }, [importEnrichedVideos, pushActivity, setStepActivity]);

  const selectAudio = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStepActivity(3, 'Selecting audio file…');
    try {
      const selected = await window.api.selectComposerAudio();
      if (!selected) {
        setActivityMessage(null);
        return;
      }
      setStepActivity(3, 'Reading audio duration…');
      const duration = await window.api.probeComposerAudio(selected);
      setAudioPath(selected);
      setAudioDurationSeconds(duration);
      setStepActivity(3, `Audio ready (${Math.round(duration)}s)`);

      if (videos.length > 0) {
        const baseClips = clips.length > 0 ? clips : buildInitialClips(videos);
        await planTimeline(videos, baseClips, duration);
      }
    } catch (audioError) {
      const message = audioError instanceof Error ? audioError.message : 'Unable to read audio';
      setError(message);
      pushActivity('error', message);
    } finally {
      setBusy(false);
    }
  }, [buildInitialClips, clips, planTimeline, pushActivity, setStepActivity, videos]);

  const updateClip = useCallback((clipId: string, patch: Partial<ComposerClip>) => {
    setTimelinePlanned(false);
    setClips((current) => current.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)));
  }, []);

  const reorderClip = useCallback((clipId: string, newOffset: number) => {
    setTimelinePlanned(false);
    setClips((current) => {
      const clip = current.find((item) => item.id === clipId);
      if (!clip) {
        return current;
      }
      const others = current
        .filter((item) => item.id !== clipId)
        .sort((a, b) => a.timelineOffset - b.timelineOffset);
      const next = [...others, { ...clip, timelineOffset: Math.max(0, newOffset) }].sort(
        (a, b) => a.timelineOffset - b.timelineOffset,
      );
      let cursor = 0;
      return next.map((item) => {
        const normalized = { ...item, timelineOffset: cursor };
        cursor += item.durationSeconds;
        return normalized;
      });
    });
  }, []);

  const removeVideo = useCallback(
    async (videoPath: string) => {
      const nextVideos = videos.filter((video) => video.path !== videoPath);
      setThumbnails((current) => {
        const next = { ...current };
        delete next[videoPath];
        return next;
      });
      setProxyPaths((current) => {
        const next = { ...current };
        delete next[videoPath];
        return next;
      });

      if (nextVideos.length === 0) {
        setVideos([]);
        setClips([]);
        setSelectedClipId(null);
        setTimelinePlanned(false);
        return;
      }

      setVideos(nextVideos);
      setTimelinePlanned(false);
      const rebuilt = buildInitialClips(nextVideos);
      if (audioPath && audioDurationSeconds > 0) {
        await planTimeline(nextVideos, rebuilt, audioDurationSeconds);
      } else if (composerMode === 'video-only') {
        await planTimeline(nextVideos, rebuilt, 0, { mode: 'video-only' });
      } else {
        setClips(rebuilt);
      }
      setSelectedClipId((current) => {
        const stillExists = rebuilt.some((clip) => clip.id === current);
        return stillExists ? current : (rebuilt[0]?.id ?? null);
      });
    },
    [audioDurationSeconds, audioPath, buildInitialClips, composerMode, planTimeline, videos],
  );

  const removeClip = useCallback(
    async (clipId: string) => {
      const clip = clips.find((item) => item.id === clipId);
      if (!clip) {
        return;
      }

      if (!clip.isFiller && !clip.isPadImage) {
        await removeVideo(clip.sourcePath);
        return;
      }

      const nextClips = clips.filter((item) => item.id !== clipId);
      setClips(nextClips);
      setTimelinePlanned(true);
      setSelectedClipId((current) => {
        if (current && nextClips.some((item) => item.id === current)) {
          return current;
        }
        return nextClips[0]?.id ?? null;
      });
    },
    [clips, removeVideo],
  );

  const updateWatermark = useCallback((patch: Partial<WatermarkConfig>) => {
    setBranding((current) => ({ ...current, watermark: { ...current.watermark, ...patch } }));
  }, []);

  const updateWatermarkWithEnable = useCallback((patch: Partial<WatermarkConfig>) => {
    setBranding((current) => ({
      ...current,
      watermark: {
        ...current.watermark,
        ...patch,
        enabled: patch.enabled ?? true,
      },
    }));
  }, []);

  const updateWatermarkText = useCallback((patch: Partial<WatermarkConfig['text']>) => {
    setBranding((current) => ({
      ...current,
      watermark: {
        ...current.watermark,
        enabled: true,
        text: { ...current.watermark.text, ...patch },
      },
    }));
  }, []);

  const updateMovingText = useCallback((patch: Partial<MovingTextConfig>) => {
    setBranding((current) => ({ ...current, movingText: { ...current.movingText, ...patch } }));
  }, []);

  const updateSideImage = useCallback((side: BrandingSide, patch: Partial<BrandingCanvasConfig['top']>) => {
    setBranding((current) => ({
      ...current,
      canvas: {
        ...current.canvas,
        [side]: { ...current.canvas[side], ...patch },
      },
    }));
  }, []);

  const updateImagePreset = useCallback((next: BrandingImagePresetConfig) => {
    setBranding((current) => ({ ...current, imagePreset: next }));
  }, []);

  const updateSubtitles = useCallback((patch: Partial<BrandingSubtitlesConfig>) => {
    setBranding((current) => ({
      ...current,
      subtitles: { ...current.subtitles, ...patch },
    }));
  }, []);

  const selectLogoImage = useCallback(async () => {
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

  const selectOutputPath = useCallback(async () => {
    const selected = await window.api.selectBrandingOutputFolder();
    if (selected) {
      setOutputFolder(selected);
    }
  }, []);

  const changeOutputFileName = useCallback((next: string) => {
    setOutputFileName(next);
  }, []);

  const exportVideo = useCallback(async () => {
    if (videos.length === 0 || !outputPath) {
      return;
    }
    if (composerMode === 'video-plus-audio' && !audioPath) {
      return;
    }

    if (hasAnyBrandingEnabled(branding)) {
      const validationError = validateBrandingConfig(branding);
      if (validationError) {
        setError(validationError);
        pushActivity('error', validationError);
        return;
      }
    }

    setError(null);
    setExportedOutputPath(null);
    setStepActivity(5, 'Starting export…');
    try {
      let exportClips = clips;
      if (!timelinePlanned) {
        const planned = await planTimeline(videos, clips, audioDurationSeconds, {
          mode: composerMode,
        });
        exportClips = planned.clips;
      }

      await window.api.startComposerExport({
        clips: exportClips,
        audioPath: composerMode === 'video-plus-audio' ? audioPath : null,
        audioDelaySeconds: COMPOSER_AUDIO_DELAY_SECONDS,
        audioDurationSeconds:
          composerMode === 'video-plus-audio' ? audioDurationSeconds : undefined,
        sourceProbes: Object.fromEntries(
          videos.map((video) => [
            video.path,
            { durationSeconds: video.durationSeconds, hasAudio: video.hasAudio },
          ]),
        ),
        branding,
        transitionDurationSeconds: COMPOSER_TRANSITION_SECONDS,
        outputPath,
        outputWidth: videos[0].width,
        outputHeight: videos[0].height,
        mode: composerMode,
      });
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Unable to start export';
      setError(message);
      pushActivity('error', message);
    }
  }, [
    audioDurationSeconds,
    audioPath,
    clips,
    branding,
    composerMode,
    outputPath,
    planTimeline,
    pushActivity,
    setStepActivity,
    timelinePlanned,
    videos,
  ]);

  const cancel = useCallback(async () => {
    await window.api.cancelComposer();
  }, []);

  const isWorking =
    progress.status === 'importing' ||
    progress.status === 'analyzing' ||
    progress.status === 'exporting';

  const createNewProject = useCallback(async () => {
    if (isWorking) {
      await cancel();
    }

    // Stop preview first so Chromium releases open video/audio file handles.
    setIsPreviewPlaying(false);
    setPlayheadSeconds(0);
    setExportedOutputPath(null);
    setVideos([]);
    setAudioPath(null);
    setAudioDurationSeconds(0);
    setCustomDurationSeconds(null);
    setPadImagePath(null);
    setClips([]);
    videosRef.current = [];
    clipsRef.current = [];
    setThumbnails({});
    setProxyPaths({});
    setSelectedClipId(null);
    setTimelinePlanned(false);
    setError(null);
    setTimelineZoom(28);
    setActivityMessage(null);
    setActivityLogs([]);
    setProgress({ ...INITIAL_COMPOSER_PROGRESS, logs: [] });

    try {
      await window.api.clearComposerMedia();
    } catch {
      // best-effort temp/proxy cleanup
    }

    try {
      applyResolvedOutputPath(await window.api.resolveComposerOutputPath());
    } catch {
      setOutputFolder(null);
      setOutputFileName('combined');
    }

    pushActivity(
      'info',
      'New project started — media cleared; mode & branding settings kept.',
    );
  }, [applyResolvedOutputPath, cancel, isWorking, pushActivity]);
  const idle = !isWorking && !busy && !otherJobActive;
  const ready =
    videos.length > 0 &&
    Boolean(outputPath) &&
    (composerMode === 'video-only' || Boolean(audioPath));
  const hasProjectContent =
    videos.length > 0 ||
    Boolean(audioPath) ||
    clips.length > 0 ||
    Boolean(exportedOutputPath);

  const combinedLogs = useMemo(() => {
    const merged = [...activityLogs, ...progress.logs];
    const seen = new Set<string>();
    return merged.filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
  }, [activityLogs, progress.logs]);

  return {
    progress,
    videos,
    audioPath,
    audioDurationSeconds,
    composerMode,
    customDurationSeconds,
    padImagePath,
    naturalVideoDurationSeconds,
    targetDurationSeconds,
    placedDuration,
    clips,
    branding,
    settingsProfiles,
    outputPath,
    outputFileName,
    thumbnails,
    proxyPaths,
    selectedClipId,
    selectedClip,
    exportedOutputPath,
    previewDurationSeconds,
    playheadSeconds,
    isPreviewPlaying,
    timelineZoom,
    previewDimensions,
    activityMessage,
    activityLogs: combinedLogs,
    error,
    busy,
    isWorking,
    ready,
    timelinePlanned,
    canAddVideos: idle,
    canExport: idle && ready,
    canCancel: isWorking,
    canCreateNew: idle,
    hasProjectContent,
    setSelectedClipId,
    selectClip: (clipId: string) => {
      setSelectedClipId(clipId);
      setIsPreviewPlaying(false);
      const clip = clips.find((item) => item.id === clipId);
      if (clip) {
        setPlayheadSeconds(Math.max(0, clip.timelineOffset));
      }
    },
    selectVideo: (videoPath: string) => {
      const clip =
        clips.find((item) => item.sourcePath === videoPath && !item.isFiller && !item.isPadImage) ??
        clips.find((item) => item.sourcePath === videoPath);
      if (!clip) {
        return;
      }
      setSelectedClipId(clip.id);
      setIsPreviewPlaying(false);
      setPlayheadSeconds(Math.max(0, clip.timelineOffset));
    },
    setPlayheadSeconds,
    setIsPreviewPlaying,
    setTimelineZoom,
    changeComposerMode: (mode: ComposerMode) => {
      setComposerMode(mode);
      saveComposerMode(mode);
      setTimelinePlanned(false);
      if (mode === 'video-only' && videos.length > 0) {
        void planTimeline(videos, buildInitialClips(videos), 0, { mode: 'video-only' });
      } else if (
        mode === 'video-plus-audio' &&
        videos.length > 0 &&
        audioPath &&
        audioDurationSeconds > 0
      ) {
        void planTimeline(videos, buildInitialClips(videos), audioDurationSeconds, {
          mode: 'video-plus-audio',
        });
      }
    },
    changeCustomDurationSeconds: (value: number | null) => {
      setCustomDurationSeconds(value);
      setTimelinePlanned(false);
      if (composerMode === 'video-only' && videos.length > 0) {
        void planTimeline(videos, buildInitialClips(videos), 0, {
          mode: 'video-only',
          customDuration: value,
        });
      }
    },
    selectPadImage: async () => {
      const selected = await window.api.selectBrandingLogo();
      if (!selected) {
        return;
      }
      setPadImagePath(selected);
      setTimelinePlanned(false);
      if (composerMode === 'video-only' && videos.length > 0) {
        await planTimeline(videos, buildInitialClips(videos), 0, {
          mode: 'video-only',
          padImage: selected,
        });
      }
    },
    clearPadImage: () => {
      setPadImagePath(null);
      setTimelinePlanned(false);
      if (composerMode === 'video-only' && videos.length > 0) {
        void planTimeline(videos, buildInitialClips(videos), 0, {
          mode: 'video-only',
          padImage: null,
        });
      }
    },
    addVideos,
    selectAudio,
    updateClip,
    reorderClip,
    removeClip,
    removeVideo,
    updateWatermark,
    updateWatermarkWithEnable,
    updateWatermarkText,
    updateMovingText,
    updateSideImage,
    updateImagePreset,
    updateSubtitles,
    selectLogoImage,
    selectSideImage,
    selectOutputPath,
    changeOutputFileName,
    exportVideo,
    cancel,
    createNewProject,
  };
}

function stripMp4Extension(name: string): string {
  return name.replace(/\.mp4$/i, '');
}

function sanitizeOutputFileName(raw: string): string {
  let name = raw
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\.+$/, '');
  name = stripMp4Extension(name).trim();
  return name || 'combined';
}

function parseOutputPath(fullPath: string): { folder: string; fileName: string } {
  const cleaned = fullPath.replace(/[\\/]+$/, '');
  const match = cleaned.match(/^(.*)[/\\]([^/\\]+)$/);
  if (!match) {
    return { folder: '', fileName: stripMp4Extension(cleaned) || 'combined' };
  }
  return {
    folder: match[1],
    fileName: stripMp4Extension(match[2]) || 'combined',
  };
}

function joinOutputPath(folder: string, fileName: string): string {
  return `${folder.replace(/[\\/]+$/, '')}/${sanitizeOutputFileName(fileName)}.mp4`;
}

export type VideoComposerController = ReturnType<typeof useVideoComposer>;

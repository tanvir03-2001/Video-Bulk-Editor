import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMPOSER_AUDIO_DELAY_SECONDS } from '../../../shared/composer';
import type { ComposerClip } from '../../../shared/composer';
import type { BrandingConfig } from '../../../shared/branding';
import { BrandingCssOverlay } from '../branding/BrandingCssOverlay';
import { Panel } from '../ui/ui';
import {
  resolveClipAtTimeline,
  timelineSecondsFromClip,
} from './composerPreviewTime';

interface ComposerPreviewProps {
  clips: ComposerClip[];
  proxyPaths: Record<string, string>;
  audioPath: string | null;
  branding: BrandingConfig;
  exportedPath: string | null;
  previewWidth?: number;
  previewHeight?: number;
  durationSeconds?: number;
  playheadSeconds?: number;
  isPlaying?: boolean;
  onPlayheadChange?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  label?: string;
}

export function ComposerPreview({
  clips,
  proxyPaths,
  audioPath,
  branding,
  exportedPath,
  previewWidth,
  previewHeight,
  durationSeconds = 0,
  playheadSeconds = 0,
  isPlaying = false,
  onPlayheadChange,
  onPlayingChange,
  label,
}: ComposerPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState(false);
  const activeClipIdRef = useRef<string | null>(null);
  const syncingFromTimelineRef = useRef(false);

  const isExported = Boolean(exportedPath);
  const aspectRatio =
    previewWidth && previewHeight && previewWidth > 0 && previewHeight > 0
      ? `${previewWidth} / ${previewHeight}`
      : '16 / 9';

  const timelinePosition = useMemo(
    () => resolveClipAtTimeline(clips, playheadSeconds),
    [clips, playheadSeconds],
  );

  const activeMediaPath = useMemo(() => {
    if (isExported || !timelinePosition) {
      return exportedPath;
    }
    const { clip } = timelinePosition;
    if (clip.isFiller) {
      return proxyPaths[clip.sourcePath] ?? clip.sourcePath;
    }
    return proxyPaths[clip.sourcePath] ?? clip.sourcePath;
  }, [exportedPath, isExported, proxyPaths, timelinePosition]);

  useEffect(() => {
    setPlaybackError(false);
    if (!activeMediaPath) {
      setVideoUrl(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const url = await window.api.getLocalMediaUrl(activeMediaPath);
        if (!cancelled) {
          setVideoUrl(url);
        }
      } catch {
        if (!cancelled) {
          setVideoUrl(null);
          setPlaybackError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeMediaPath]);

  useEffect(() => {
    if (!audioPath || isExported) {
      setAudioUrl(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const url = await window.api.getLocalMediaUrl(audioPath);
        if (!cancelled) {
          setAudioUrl(url);
        }
      } catch {
        if (!cancelled) {
          setAudioUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioPath, isExported]);

  const applyTimelineToVideo = useCallback(
    (timelineSeconds: number) => {
      const video = videoRef.current;
      if (!video || isExported) {
        return;
      }

      const position = resolveClipAtTimeline(clips, timelineSeconds);
      if (!position) {
        return;
      }

      const targetTime = position.clip.startSeconds + position.localSeconds;
      activeClipIdRef.current = position.clip.id;

      syncingFromTimelineRef.current = true;
      const seek = (): void => {
        if (Number.isFinite(targetTime)) {
          video.currentTime = targetTime;
        }
        window.setTimeout(() => {
          syncingFromTimelineRef.current = false;
        }, 50);
      };

      if (video.readyState >= 1) {
        seek();
        return;
      }

      const onReady = (): void => {
        video.removeEventListener('loadedmetadata', onReady);
        seek();
      };
      video.addEventListener('loadedmetadata', onReady);
    },
    [clips, isExported],
  );

  const applyTimelineToAudio = useCallback(
    (timelineSeconds: number, playing: boolean) => {
      const audio = audioRef.current;
      if (!audio || !audioUrl || isExported) {
        return;
      }

      if (timelineSeconds < COMPOSER_AUDIO_DELAY_SECONDS) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }

      const audioTime = timelineSeconds - COMPOSER_AUDIO_DELAY_SECONDS;
      if (Math.abs(audio.currentTime - audioTime) > 0.25) {
        audio.currentTime = audioTime;
      }

      if (playing) {
        void audio.play().catch(() => {
          // ignore autoplay restrictions while scrubbing
        });
      } else {
        audio.pause();
      }
    },
    [audioUrl, isExported],
  );

  useEffect(() => {
    if (isExported || !videoUrl) {
      return;
    }

    const position = resolveClipAtTimeline(clips, playheadSeconds);
    const video = videoRef.current;
    if (!position || !video) {
      return;
    }

    const expectedVideoTime = position.clip.startSeconds + position.localSeconds;
    const clipChanged = activeClipIdRef.current !== position.clip.id;
    const farOff = Math.abs(video.currentTime - expectedVideoTime) > 0.45;

    if (clipChanged || !isPlaying || farOff) {
      applyTimelineToVideo(playheadSeconds);
    }
    applyTimelineToAudio(playheadSeconds, isPlaying);
  }, [
    applyTimelineToAudio,
    applyTimelineToVideo,
    clips,
    isExported,
    isPlaying,
    playheadSeconds,
    videoUrl,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || isExported) {
      return;
    }

    if (isPlaying) {
      void video.play().catch(() => {
        onPlayingChange?.(false);
      });
      return;
    }

    video.pause();
  }, [isExported, isPlaying, onPlayingChange, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || isExported) {
      return;
    }

    if (Math.abs(video.currentTime - playheadSeconds) > 0.2 && isExported) {
      video.currentTime = playheadSeconds;
    }
  }, [isExported, playheadSeconds, videoUrl]);

  const handleVideoTimeUpdate = (): void => {
    if (syncingFromTimelineRef.current || isExported) {
      return;
    }

    const video = videoRef.current;
    if (!video || !timelinePosition) {
      return;
    }

    const { clip } = timelinePosition;
    const localPlayed = video.currentTime - clip.startSeconds;
    if (localPlayed >= clip.durationSeconds - 0.08) {
      const nextTimeline = clip.timelineOffset + clip.durationSeconds + 0.01;
      if (durationSeconds > 0 && nextTimeline < durationSeconds) {
        onPlayheadChange?.(nextTimeline);
      } else {
        onPlayingChange?.(false);
        onPlayheadChange?.(Math.min(durationSeconds, clip.timelineOffset + clip.durationSeconds));
      }
      return;
    }

    onPlayheadChange?.(timelineSecondsFromClip(clip, video.currentTime));
  };

  const showBranding = !isExported;

  return (
    <Panel className="space-y-3 bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-300">{label ?? 'Preview'}</p>
        <div className="flex items-center gap-2">
          {isExported ? (
            <span className="text-[10px] text-emerald-400">Exported output</span>
          ) : clips.length > 0 ? (
            <span className="text-[10px] text-sky-400">Instant preview</span>
          ) : null}
        </div>
      </div>
      <div
        className="relative mx-auto w-full max-w-full overflow-hidden rounded-lg border border-surface-border bg-black shadow-inner [container-type:size]"
        style={{ aspectRatio }}
      >
        {videoUrl && !playbackError ? (
          <>
            <video
              ref={videoRef}
              key={isExported ? videoUrl : (timelinePosition?.clip.id ?? videoUrl)}
              src={videoUrl}
              controls={isExported}
              playsInline
              muted={!isExported}
              onPlay={() => {
                if (isExported) {
                  onPlayingChange?.(true);
                  return;
                }
                onPlayingChange?.(true);
              }}
              onPause={() => {
                onPlayingChange?.(false);
              }}
              onSeeked={() => {
                if (isExported) {
                  const video = videoRef.current;
                  if (video) {
                    onPlayheadChange?.(video.currentTime);
                  }
                  return;
                }
                syncingFromTimelineRef.current = false;
              }}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={() => {
                onPlayingChange?.(false);
              }}
              onError={() => {
                setPlaybackError(true);
              }}
              className="block h-full w-full object-contain"
            />
            {audioUrl && !isExported ? (
              <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />
            ) : null}
            {showBranding ? <BrandingCssOverlay config={branding} /> : null}
          </>
        ) : videoUrl && playbackError ? (
          <div className="flex min-h-[160px] items-center justify-center px-3 text-center text-xs leading-relaxed text-rose-200">
            Preview could not be played. Try removing and re-adding the video.
          </div>
        ) : (
          <div className="flex min-h-[160px] items-center justify-center px-3 text-center text-xs leading-relaxed text-slate-400">
            {clips.length > 0 ? 'Loading preview…' : 'Add videos to see a live preview.'}
          </div>
        )}
      </div>
      {!isExported && clips.length > 0 ? (
        <p className="text-xs leading-relaxed text-slate-500">
          Instant preview plays from the timeline immediately. Watermark, side images, and moving text
          update live in the inspector.
        </p>
      ) : null}
    </Panel>
  );
}

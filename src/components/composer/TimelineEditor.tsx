import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMPOSER_AUDIO_DELAY_SECONDS } from '../../../shared/composer';
import type { ComposerClip } from '../../../shared/composer';
import { Icon } from '../ui/Icon';

interface TimelineEditorProps {
  clips: ComposerClip[];
  thumbnails: Record<string, string[]>;
  targetDurationSeconds: number;
  audioDurationSeconds: number;
  audioPath: string | null;
  selectedClipId: string | null;
  playheadSeconds: number;
  isPlaying: boolean;
  pixelsPerSecond?: number;
  onSelectClip: (clipId: string) => void;
  onReorderClip: (clipId: string, newOffset: number) => void;
  onRemoveClip: (clipId: string) => void;
  onPlayheadChange: (seconds: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onZoomChange?: (pixelsPerSecond: number) => void;
}

function formatClock(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function audioFileName(audioPath: string | null): string {
  if (!audioPath) {
    return 'Not selected';
  }
  return audioPath.split(/[\\/]/).pop() ?? audioPath;
}

function FilmstripBackground({ thumbPath }: { thumbPath: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbPath) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const mediaUrl = await window.api.getLocalMediaUrl(thumbPath);
        if (!cancelled) {
          setUrl(mediaUrl);
        }
      } catch {
        if (!cancelled) {
          setUrl(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [thumbPath]);

  if (!url) {
    return <div className="absolute inset-0 bg-slate-800/80" />;
  }

  return (
    <div
      className="absolute inset-0 opacity-90"
      style={{
        backgroundImage: `url("${url}")`,
        backgroundRepeat: 'repeat-x',
        backgroundSize: 'auto 100%',
        backgroundPosition: 'left center',
      }}
    />
  );
}

export function TimelineEditor({
  clips,
  thumbnails,
  targetDurationSeconds,
  audioDurationSeconds,
  audioPath,
  selectedClipId,
  playheadSeconds,
  isPlaying,
  pixelsPerSecond = 28,
  onSelectClip,
  onReorderClip,
  onRemoveClip,
  onPlayheadChange,
  onPlayingChange,
  onZoomChange,
}: TimelineEditorProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const sortedClips = useMemo(
    () => [...clips].sort((a, b) => a.timelineOffset - b.timelineOffset),
    [clips],
  );
  const timelineDuration = Math.max(targetDurationSeconds, audioDurationSeconds, placedEnd(sortedClips), 1);
  const timelineWidth = timelineDuration * pixelsPerSecond + 120;
  const playheadLeft = playheadSeconds * pixelsPerSecond;
  const rulerMarks = useMemo(() => {
    const step = timelineDuration > 90 ? 10 : 5;
    const marks: number[] = [];
    for (let second = 0; second <= timelineDuration; second += step) {
      marks.push(second);
    }
    return marks;
  }, [timelineDuration]);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) {
        return;
      }
      const rect = track.getBoundingClientRect();
      const x = clientX - rect.left + track.scrollLeft - 48;
      const seconds = Math.max(0, Math.min(timelineDuration, x / pixelsPerSecond));
      onPlayheadChange(seconds);
    },
    [onPlayheadChange, pixelsPerSecond, timelineDuration],
  );

  useEffect(() => {
    if (!draggingPlayhead) {
      return;
    }

    const onMove = (event: MouseEvent): void => {
      seekFromClientX(event.clientX);
    };
    const onUp = (): void => {
      setDraggingPlayhead(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingPlayhead, seekFromClientX]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!selectedClipId || (event.key !== 'Delete' && event.key !== 'Backspace')) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      onRemoveClip(selectedClipId);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onRemoveClip, selectedClipId]);

  return (
    <div className="space-y-2 rounded-lg border border-surface-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-surface-border/80 bg-surface-raised/60 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-slate-300 transition hover:bg-surface-border/40 hover:text-white"
            onClick={() => {
              onPlayingChange(!isPlaying);
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={isPlaying ? 'stop' : 'play'} size={14} />
          </button>
        </div>
        <p className="font-mono text-[11px] text-slate-300">
          {formatClock(playheadSeconds)} | {formatClock(timelineDuration)}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded px-1 text-xs text-slate-400 hover:text-white"
            onClick={() => {
              onZoomChange?.(Math.max(12, pixelsPerSecond - 4));
            }}
            aria-label="Zoom out"
          >
            −
          </button>
          <input
            type="range"
            min={12}
            max={64}
            step={2}
            value={pixelsPerSecond}
            onChange={(event) => {
              onZoomChange?.(Number(event.target.value));
            }}
            className="h-1 w-24 accent-sky-400"
            aria-label="Timeline zoom"
          />
          <button
            type="button"
            className="rounded px-1 text-xs text-slate-400 hover:text-white"
            onClick={() => {
              onZoomChange?.(Math.min(64, pixelsPerSecond + 4));
            }}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div ref={trackRef} className="overflow-x-auto">
        <div className="relative min-w-full" style={{ width: timelineWidth }}>
          <div
            className="relative mb-1 ml-12 h-6 cursor-pointer border-b border-surface-border/80"
            onClick={(event) => {
              seekFromClientX(event.clientX);
            }}
          >
            {rulerMarks.map((second) => (
              <span
                key={second}
                className="absolute top-0 text-[10px] text-slate-500"
                style={{ left: 48 + second * pixelsPerSecond }}
              >
                {formatClock(second)}
              </span>
            ))}
          </div>

          <div
            className="pointer-events-none absolute bottom-0 top-0 z-30 ml-12"
            style={{ left: playheadLeft }}
          >
            <div
              className="pointer-events-auto -ml-2 h-4 w-4 cursor-ew-resize rounded-sm border border-slate-900 bg-white shadow"
              onMouseDown={(event) => {
                event.preventDefault();
                setDraggingPlayhead(true);
                seekFromClientX(event.clientX);
              }}
            />
            <div className="h-full w-0.5 bg-slate-900" />
          </div>

          <div className="relative mb-2 flex h-20">
            <div className="sticky left-0 z-20 flex w-12 shrink-0 flex-col items-center justify-center gap-2 border-r border-surface-border bg-surface px-1">
              <Icon name="video" size={14} className="text-slate-400" />
              <div className="rounded bg-surface-raised p-1">
                <Icon name="settings" size={12} className="text-slate-400" />
              </div>
            </div>

            <div className="relative ml-0 min-w-0 flex-1">
              {sortedClips.map((clip) => {
                const width = Math.max(clip.durationSeconds * pixelsPerSecond, 48);
                const left = clip.timelineOffset * pixelsPerSecond;
                const thumb = thumbnails[clip.sourcePath]?.[0] ?? null;
                const selected = clip.id === selectedClipId;
                return (
                  <div
                    key={clip.id}
                    className={`group absolute top-0 bottom-0 overflow-hidden rounded-md border transition ${
                      selected
                        ? 'border-sky-400 ring-2 ring-sky-400/40'
                        : clip.isFiller
                          ? 'border-amber-500/40'
                          : 'border-surface-border'
                    }`}
                    style={{ left, width }}
                  >
                    <button
                      type="button"
                      draggable
                      onClick={() => {
                        onSelectClip(clip.id);
                        onPlayheadChange(clip.timelineOffset);
                      }}
                      onDragEnd={(event) => {
                        const container = trackRef.current;
                        if (!container) {
                          return;
                        }
                        const rect = container.getBoundingClientRect();
                        const x = event.clientX - rect.left + container.scrollLeft - 48;
                        onReorderClip(clip.id, x / pixelsPerSecond);
                      }}
                      className="relative h-full w-full text-left"
                      title={`${clip.sourceName} · ${clip.durationSeconds.toFixed(1)}s`}
                    >
                      {clip.isFiller ? (
                        <div className="absolute inset-y-0 left-0 z-10 w-1 bg-amber-400/80" />
                      ) : (
                        <FilmstripBackground thumbPath={thumb} />
                      )}
                      <div className="relative z-10 flex h-full flex-col justify-end bg-gradient-to-t from-black/75 via-black/10 to-transparent p-1.5">
                        <span className="truncate text-[10px] font-medium text-white">
                          {clip.isFiller ? 'Filler' : clip.sourceName}
                        </span>
                        <span className="text-[10px] text-slate-300">
                          {clip.durationSeconds.toFixed(1)}s
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveClip(clip.id);
                      }}
                      className="absolute right-1 top-1 z-20 rounded bg-black/70 p-0.5 text-slate-200 opacity-0 transition hover:bg-rose-900/90 hover:text-white group-hover:opacity-100"
                      title="Remove clip"
                      aria-label={`Remove ${clip.sourceName}`}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative ml-12 h-9 rounded-md border border-surface-border bg-surface-raised/70">
            <div
              className="absolute bottom-1 top-1 rounded bg-emerald-500/25"
              style={{
                left: COMPOSER_AUDIO_DELAY_SECONDS * pixelsPerSecond,
                width: Math.max(audioDurationSeconds * pixelsPerSecond, 8),
              }}
            />
            <span
              className="absolute top-1/2 max-w-[70%] -translate-y-1/2 truncate text-[10px] text-emerald-300"
              style={{ left: COMPOSER_AUDIO_DELAY_SECONDS * pixelsPerSecond + 4 }}
              title={audioPath ?? undefined}
            >
              {audioFileName(audioPath)} (+1s delay)
            </span>
            {targetDurationSeconds > 0 ? (
              <span
                className="absolute top-0 h-full border-l border-dashed border-rose-400/70"
                style={{ left: targetDurationSeconds * pixelsPerSecond }}
                title="Target end"
              />
            ) : null}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Drag clips to reorder. Click the ruler to seek. Select a clip and press Delete to remove it.
      </p>
    </div>
  );
}

function placedEnd(clips: ComposerClip[]): number {
  if (clips.length === 0) {
    return 0;
  }
  const last = clips[clips.length - 1];
  return last.timelineOffset + last.durationSeconds;
}

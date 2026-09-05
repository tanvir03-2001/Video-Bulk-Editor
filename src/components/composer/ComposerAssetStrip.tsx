import type { ComposerVideoItem } from '../../hooks/useVideoComposer';
import { TimelineThumbnail } from './TimelineThumbnail';
import { Icon } from '../ui/Icon';

interface ComposerAssetStripProps {
  videos: ComposerVideoItem[];
  thumbnails: Record<string, string[]>;
  selectedVideoPath?: string | null;
  disabled: boolean;
  onSelectVideo?: (videoPath: string) => void;
  onRemoveVideo: (videoPath: string) => void;
}

export function ComposerAssetStrip({
  videos,
  thumbnails,
  selectedVideoPath = null,
  disabled,
  onSelectVideo,
  onRemoveVideo,
}: ComposerAssetStripProps) {
  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-surface-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-300">Uploaded videos</p>
        <span className="text-[11px] text-slate-500">{videos.length} in project</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {videos.map((video, index) => {
          const thumb = thumbnails[video.path]?.[0] ?? null;
          const selected = selectedVideoPath === video.path;
          return (
            <div
              key={video.path}
              role="button"
              tabIndex={0}
              title={`#${index + 1} — click to jump to this video’s timeframe`}
              onClick={() => {
                onSelectVideo?.(video.path);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectVideo?.(video.path);
                }
              }}
              className={[
                'group relative w-24 cursor-pointer overflow-hidden rounded-md border bg-surface-raised transition',
                selected
                  ? 'border-accent ring-1 ring-accent/50'
                  : 'border-surface-border hover:border-slate-500',
              ].join(' ')}
            >
              <span className="absolute left-1 top-1 z-[1] rounded bg-black/70 px-1 text-[9px] font-semibold text-slate-200">
                {index + 1}
              </span>
              <TimelineThumbnail
                thumbPath={thumb}
                className="aspect-[9/16] h-auto w-full object-cover"
              />
              <div className="space-y-0.5 p-1.5">
                <p className="truncate text-[10px] font-medium text-slate-200" title={video.name}>
                  {video.name}
                </p>
                <p className="text-[10px] text-slate-500">{Math.round(video.durationSeconds)}s</p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveVideo(video.path);
                }}
                className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 disabled:opacity-40"
                title="Remove video"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

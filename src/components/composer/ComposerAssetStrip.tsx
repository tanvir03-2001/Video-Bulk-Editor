import type { ComposerVideoItem } from '../../hooks/useVideoComposer';
import { TimelineThumbnail } from './TimelineThumbnail';
import { Icon } from '../ui/Icon';

interface ComposerAssetStripProps {
  videos: ComposerVideoItem[];
  thumbnails: Record<string, string[]>;
  disabled: boolean;
  onRemoveVideo: (videoPath: string) => void;
}

export function ComposerAssetStrip({
  videos,
  thumbnails,
  disabled,
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
        {videos.map((video) => {
          const thumb = thumbnails[video.path]?.[0] ?? null;
          return (
            <div
              key={video.path}
              className="group relative w-24 overflow-hidden rounded-md border border-surface-border bg-surface-raised"
            >
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
                onClick={() => {
                  onRemoveVideo(video.path);
                }}
                className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-slate-200 opacity-0 transition hover:bg-rose-900/90 hover:text-white group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                title={`Remove ${video.name}`}
                aria-label={`Remove ${video.name}`}
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

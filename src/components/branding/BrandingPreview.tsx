import { useEffect, useState } from 'react';
import type { BrandingProgress } from '../../../shared/branding';
import type { VideoFile } from '../../../shared/ipc';

interface BrandingPreviewProps {
  progress: BrandingProgress;
  videos: VideoFile[];
  previewVideoPath: string | null;
  previewUrl: string | null;
  outputFolder: string | null;
  canPreview: boolean;
  canApply: boolean;
  canCancel: boolean;
  onPreviewVideoChange: (videoPath: string) => void;
  onGeneratePreview: () => void;
  onApplyToAll: () => void;
  onCancel: () => void;
  onSelectOutputFolder: () => void;
  onResetOutputFolder: () => void;
}

const btn =
  'rounded-md px-3 py-1.5 text-sm font-medium tracking-readable text-white transition disabled:cursor-not-allowed disabled:opacity-40';
const inputBase =
  'w-full rounded-md border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 outline-none transition focus:border-accent disabled:opacity-40';

export function BrandingPreview({
  progress,
  videos,
  previewVideoPath,
  previewUrl,
  outputFolder,
  canPreview,
  canApply,
  canCancel,
  onPreviewVideoChange,
  onGeneratePreview,
  onApplyToAll,
  onCancel,
  onSelectOutputFolder,
  onResetOutputFolder,
}: BrandingPreviewProps) {
  const hasPreview = Boolean(previewUrl);
  const [playbackError, setPlaybackError] = useState(false);

  useEffect(() => {
    setPlaybackError(false);
  }, [previewUrl]);

  return (
    <div className="space-y-2.5 rounded-md border border-surface-border bg-surface px-3 py-2.5">
      <label htmlFor="preview-video" className="text-xs font-medium tracking-readable text-slate-300">
        Preview Video
      </label>
      <select
        id="preview-video"
        value={previewVideoPath ?? ''}
        disabled={videos.length === 0 || !canPreview}
        onChange={(event) => {
          onPreviewVideoChange(event.target.value);
        }}
        className={inputBase}
      >
        {videos.length === 0 ? <option value="">No videos scanned</option> : null}
        {videos.map((video) => (
          <option key={video.path} value={video.path}>
            {video.name}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGeneratePreview}
          disabled={!canPreview}
          className={`${btn} bg-accent hover:bg-accent-muted`}
        >
          {hasPreview ? 'Regenerate Preview' : 'Generate Preview'}
        </button>
        <button
          type="button"
          onClick={onApplyToAll}
          disabled={!canApply}
          className={`${btn} bg-emerald-600 hover:bg-emerald-500`}
        >
          Apply to All Videos
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!canCancel}
          className={`${btn} bg-rose-700 hover:bg-rose-600`}
        >
          Cancel
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-surface-border bg-black">
        {previewUrl && !playbackError ? (
          <video
            key={previewUrl}
            src={previewUrl}
            controls
            autoPlay
            loop
            muted
            playsInline
            onError={() => {
              setPlaybackError(true);
            }}
            className="h-40 w-full bg-black object-contain"
          />
        ) : previewUrl && playbackError ? (
          <div className="flex h-40 items-center justify-center px-3 text-center text-xs leading-relaxed text-rose-200">
            The preview clip was created but could not be played here. It is saved as an MP4 in
            your system temp folder.
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center px-3 text-center text-xs leading-relaxed text-slate-400">
            {progress.status === 'previewing'
              ? `Rendering 5-second preview… ${Math.round(progress.currentVideoPercent)}%`
              : 'Generate a preview to see the branding on a real 5-second clip.'}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium tracking-readable text-slate-300">Output Folder</p>
        <p
          className="mt-1 truncate font-mono text-xs leading-relaxed text-slate-400"
          title={outputFolder ?? undefined}
        >
          {outputFolder ?? 'Select a folder to set the default output'}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectOutputFolder}
            disabled={!canPreview && !canApply}
            className={`${btn} bg-slate-700 hover:bg-slate-600`}
          >
            Change Output Folder
          </button>
          <button
            type="button"
            onClick={onResetOutputFolder}
            disabled={!canPreview && !canApply}
            className={`${btn} bg-slate-700 hover:bg-slate-600`}
          >
            Use Default
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Original videos are never modified or overwritten.
        </p>
      </div>
    </div>
  );
}

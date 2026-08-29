import { useEffect, useState } from 'react';
import type { BrandingProgress } from '../../../shared/branding';
import type { VideoFile } from '../../../shared/ipc';
import { Button, Panel } from '../ui/ui';

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
    <Panel className="space-y-3 bg-surface p-3.5">
      <label htmlFor="preview-video" className="text-xs font-medium text-slate-300">
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
        <Button
          variant="primary"
          icon="refresh"
          onClick={onGeneratePreview}
          disabled={!canPreview}
        >
          {hasPreview ? 'Regenerate Preview' : 'Generate Preview'}
        </Button>
        <Button
          variant="success"
          icon="play"
          onClick={onApplyToAll}
          disabled={!canApply}
        >
          Apply to All Videos
        </Button>
        <Button
          variant="danger"
          icon="stop"
          onClick={onCancel}
          disabled={!canCancel}
        >
          Cancel
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-surface-border bg-black shadow-inner">
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
            className="aspect-video max-h-64 w-full bg-black object-contain"
          />
        ) : previewUrl && playbackError ? (
          <div className="flex aspect-video max-h-64 items-center justify-center px-3 text-center text-xs leading-relaxed text-rose-200">
            The preview clip was created but could not be played here. It is saved as an MP4 in
            your system temp folder.
          </div>
        ) : (
          <div className="flex aspect-video max-h-64 items-center justify-center px-3 text-center text-xs leading-relaxed text-slate-400">
            {progress.status === 'previewing'
              ? `Rendering 5-second preview… ${Math.round(progress.currentVideoPercent)}%`
              : 'Generate a preview to see the branding on a real 5-second clip.'}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-slate-300">Output Folder</p>
        <p
          className="mt-1 truncate font-mono text-xs leading-relaxed text-slate-400"
          title={outputFolder ?? undefined}
        >
          {outputFolder ?? 'Select a folder to set the default output'}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon="folder"
            onClick={onSelectOutputFolder}
            disabled={!canPreview && !canApply}
          >
            Change Output Folder
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onResetOutputFolder}
            disabled={!canPreview && !canApply}
          >
            Use Default
          </Button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Original videos are never modified or overwritten.
        </p>
      </div>
    </Panel>
  );
}

import { useEffect, useState } from 'react';
import {
  BRANDING_ASPECT_RATIO_LABELS,
  type BrandingAspectRatio,
  type BrandingConfig,
  type BrandingProgress,
} from '../../../shared/branding';
import type { VideoFile } from '../../../shared/ipc';
import { BrandingCssOverlay } from './BrandingCssOverlay';
import { Button, Panel } from '../ui/ui';

interface BrandingPreviewProps {
  progress: BrandingProgress;
  videos: VideoFile[];
  previewVideoPath: string | null;
  sourceVideoUrl: string | null;
  previewUrl: string | null;
  showInstantPreview: boolean;
  showEncodedPreview: boolean;
  config: BrandingConfig;
  outputFolder: string | null;
  aspectRatio: BrandingAspectRatio;
  customWidth: number;
  customHeight: number;
  zoomPercent: number;
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
  sourceVideoUrl,
  previewUrl,
  showInstantPreview,
  showEncodedPreview,
  config,
  outputFolder,
  aspectRatio,
  customWidth,
  customHeight,
  zoomPercent,
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
  const [playbackError, setPlaybackError] = useState(false);
  const canRenderPreview = canPreview && progress.status !== 'previewing';
  const renderedSize = progress.message?.match(/\b(\d+)x(\d+)\b/);
  const previewAspectRatio =
    aspectRatio === 'source'
      ? renderedSize
        ? `${renderedSize[1]} / ${renderedSize[2]}`
        : '16 / 9'
      : aspectRatio === 'custom'
        ? `${customWidth} / ${customHeight}`
        : aspectRatio.replace(':', ' / ');

  const activeVideoUrl = showEncodedPreview && previewUrl ? previewUrl : sourceVideoUrl;

  useEffect(() => {
    setPlaybackError(false);
  }, [activeVideoUrl]);

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
          variant="secondary"
          icon="refresh"
          onClick={onGeneratePreview}
          disabled={!canRenderPreview}
        >
          {progress.status === 'previewing' ? 'Rendering…' : 'Render Preview'}
        </Button>
        <Button variant="success" icon="play" onClick={onApplyToAll} disabled={!canApply}>
          Apply to All Videos
        </Button>
        <Button variant="danger" icon="stop" onClick={onCancel} disabled={!canCancel}>
          Cancel
        </Button>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-lg border border-surface-border bg-black shadow-inner [container-type:size]"
        style={{ aspectRatio: previewAspectRatio }}
      >
        {activeVideoUrl && !playbackError ? (
          <>
            <video
              key={activeVideoUrl}
              src={activeVideoUrl}
              controls
              autoPlay
              loop
              muted
              playsInline
              onError={() => {
                setPlaybackError(true);
              }}
              className="block h-full w-full object-cover"
            />
            {showInstantPreview ? <BrandingCssOverlay config={config} /> : null}
          </>
        ) : activeVideoUrl && playbackError ? (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs leading-relaxed text-rose-200">
            The preview clip could not be played here.
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs leading-relaxed text-slate-400">
            {progress.status === 'previewing'
              ? `Rendering FFmpeg preview… ${Math.round(progress.currentVideoPercent)}%`
              : 'Enable an overlay to see the instant preview, or press Render Preview for quality check.'}
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        {showEncodedPreview
          ? 'Showing encoded FFmpeg preview.'
          : showInstantPreview
            ? 'Instant CSS preview — overlays update immediately. Use Render Preview for final quality.'
            : 'Select a video and enable overlays to preview.'}
      </p>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-slate-300">Output Folder</p>
          <span className="text-[11px] text-slate-500">
            {BRANDING_ASPECT_RATIO_LABELS[aspectRatio]} · {zoomPercent}% zoom
          </span>
        </div>
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

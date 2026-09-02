import { useEffect, useState } from 'react';
import {
  BRANDING_ASPECT_RATIO_LABELS,
  type BrandingAspectRatio,
  type BrandingConfig,
  type BrandingProgress,
} from '../../../shared/branding';
import type { VideoFile } from '../../../shared/ipc';
import { BrandingCssOverlay } from './BrandingCssOverlay';
import { Button, Field, Panel, Select } from '../ui/ui';

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

  const ratioParts = previewAspectRatio.split('/').map((part) => Number(part.trim()));
  const ratioValue =
    ratioParts.length === 2 && ratioParts[0] > 0 && ratioParts[1] > 0
      ? ratioParts[0] / ratioParts[1]
      : 16 / 9;

  useEffect(() => {
    setPlaybackError(false);
  }, [activeVideoUrl]);

  return (
    <Panel className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden bg-surface p-3">
      <div className="shrink-0 space-y-2.5">
        <Field label="Preview Video" htmlFor="preview-video">
          <Select
            id="preview-video"
            value={previewVideoPath ?? ''}
            disabled={videos.length === 0 || !canPreview}
            onChange={(event) => {
              onPreviewVideoChange(event.target.value);
            }}
          >
            {videos.length === 0 ? <option value="">No videos scanned</option> : null}
            {videos.map((video) => (
              <option key={video.path} value={video.path}>
                {video.name}
              </option>
            ))}
          </Select>
        </Field>

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
      </div>

      <div className="min-h-0 flex-1 overflow-hidden [container-type:size]">
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="relative overflow-hidden rounded-lg border border-surface-border bg-black shadow-inner [container-type:size]"
            style={{
              aspectRatio: previewAspectRatio,
              width: `min(100cqw, calc(100cqh * ${ratioValue}))`,
              height: `min(100cqh, calc(100cqw / ${ratioValue}))`,
            }}
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
                  className="absolute inset-0 block h-full w-full object-cover"
                  style={
                    zoomPercent !== 100
                      ? { transform: `scale(${Math.max(0.5, Math.min(2, zoomPercent / 100))})` }
                      : undefined
                  }
                />
                {showInstantPreview ? (
                  <BrandingCssOverlay
                    config={config}
                    sourceWidth={
                      aspectRatio === 'custom'
                        ? customWidth
                        : renderedSize
                          ? Number(renderedSize[1])
                          : customWidth || 16
                    }
                    sourceHeight={
                      aspectRatio === 'custom'
                        ? customHeight
                        : renderedSize
                          ? Number(renderedSize[2])
                          : customHeight || 9
                    }
                  />
                ) : null}
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
        </div>
      </div>

      <div className="shrink-0 space-y-2">
        <p className="text-[11px] leading-relaxed text-slate-500">
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
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            Original videos are never modified or overwritten.
          </p>
        </div>
      </div>
    </Panel>
  );
}

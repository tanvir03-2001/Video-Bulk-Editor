import { memo, type ReactNode } from 'react';
import type { BrandingConfig, BrandingProgress } from '../../../shared/branding';
import type { ComposerProgress } from '../../../shared/composer';
import type { ImageClassificationProgress, LogEntry, ProcessingProgress } from '../../../shared/ipc';
import type { ImageEditConfig, ImageEditProgress } from '../../../shared/imageEditing';
import { Badge, Icon, Panel, ProgressBar, SectionHeading, StatusDot } from '../ui/ui';
import { cx } from '../ui/cx';
import { LogPanel } from '../LogPanel';
import type { AppView } from './Sidebar';

interface InspectorPanelProps {
  view: AppView;
  processing: ProcessingProgress;
  classification: ImageClassificationProgress;
  branding: BrandingProgress;
  imageEditing: ImageEditProgress;
  imageEditingConfig: ImageEditConfig;
  brandingConfig: BrandingConfig;
  videoAllowPercent: number;
  classifyAllowPercent: number;
  onVideoAllowPercentChange: (value: number) => void;
  onClassifyAllowPercentChange: (value: number) => void;
  brandingPreview: ReactNode;
  imageEditPreview: ReactNode;
  composerPreview: ReactNode;
  composerProgress: ComposerProgress;
  composerActivityMessage: string | null;
  composerActivityLogs: LogEntry[];
  composerIsWorking: boolean;
  composerVideoCount: number;
  composerAudioReady: boolean;
  composerOutputPath: string | null;
  composerBrandingConfig: BrandingConfig;
}

function ThresholdControl({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-slate-300">
          Allow threshold
        </label>
        <span className="font-mono text-xs tabular-nums text-sky-300">{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={5}
        max={90}
        step={5}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        className="w-full accent-accent disabled:opacity-40"
      />
      <p className="text-[11px] leading-relaxed text-slate-500">
        Scores above {value}% are sent to flagged output.
      </p>
    </div>
  );
}

function InspectorHeader({ title, description }: { title: string; description: string }) {
  return <SectionHeading title={title} description={description} />;
}

export const InspectorPanel = memo(function InspectorPanel({
  view,
  processing,
  classification,
  branding,
  imageEditing,
  imageEditingConfig,
  brandingConfig,
  videoAllowPercent,
  classifyAllowPercent,
  onVideoAllowPercentChange,
  onClassifyAllowPercentChange,
  brandingPreview,
  imageEditPreview,
  composerPreview,
  composerProgress,
  composerActivityMessage,
  composerActivityLogs,
  composerIsWorking,
  composerVideoCount,
  composerAudioReady,
  composerOutputPath,
  composerBrandingConfig,
}: InspectorPanelProps) {
  const busy =
    processing.status === 'processing' ||
    classification.status === 'classifying' ||
    branding.status === 'processing' ||
    branding.status === 'previewing' ||
    imageEditing.status === 'processing' ||
    imageEditing.status === 'previewing' ||
    composerIsWorking;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="border-b border-surface-border px-4 py-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          Inspector
        </p>
        {view === 'frames' ? (
          <InspectorHeader title="Frame extraction" description="Selection and safety policy" />
        ) : view === 'classify' ? (
          <InspectorHeader title="Classification" description="Review split behavior" />
        ) : view === 'branding' ? (
          <InspectorHeader title="Branding setup" description="Current overlay configuration" />
        ) : view === 'composer' ? (
          <InspectorHeader title="Combiner preview" description="Live preview and export progress" />
        ) : view === 'image-editor' ? (
          <InspectorHeader title="Image editing" description="Bulk image configuration" />
        ) : view === 'activity' ? (
          <InspectorHeader title="Run details" description="Live processing telemetry" />
        ) : (
          <InspectorHeader title="Workspace" description="System and session context" />
        )}
      </div>

      <div className="space-y-4 p-4">
        {view === 'frames' ? (
          <>
            <Panel className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <Icon name="frames" size={16} className="text-sky-300" />
                <p className="text-xs font-semibold text-slate-200">Detection policy</p>
              </div>
              <ThresholdControl
                id="inspector-video-threshold"
                value={videoAllowPercent}
                disabled={busy}
                onChange={onVideoAllowPercentChange}
              />
            </Panel>
            <Panel className="space-y-3 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">Current folder</p>
              <p className="break-all font-mono text-xs leading-relaxed text-slate-300">
                {processing.selectedFolder ?? 'No folder selected'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <MiniMetric label="Videos" value={processing.totalVideos} />
                <MiniMetric label="Images" value={processing.imagesGenerated} />
              </div>
            </Panel>
          </>
        ) : null}

        {view === 'classify' ? (
          <>
            <Panel className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <Icon name="classify" size={16} className="text-sky-300" />
                <p className="text-xs font-semibold text-slate-200">Detection policy</p>
              </div>
              <ThresholdControl
                id="inspector-classify-threshold"
                value={classifyAllowPercent}
                disabled={busy}
                onChange={onClassifyAllowPercentChange}
              />
            </Panel>
            <Panel className="space-y-3 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">Scan summary</p>
              <div className="grid grid-cols-2 gap-2">
                <MiniMetric label="Images" value={classification.imageCount} />
                <MiniMetric label="Videos" value={classification.videoCount} />
                <MiniMetric label="Safe" value={classification.safeImages} tone="success" />
                <MiniMetric label="Flagged" value={classification.flaggedImages} tone="warning" />
              </div>
            </Panel>
          </>
        ) : null}

        {view === 'branding' ? (
          <>
            <div className="sticky top-0 z-10 -mx-1 bg-surface/95 pb-3 backdrop-blur-sm">
              {brandingPreview}
            </div>
            <Panel className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-200">Active overlays</p>
                <Badge tone={hasCanvasChanges(brandingConfig) ? 'success' : 'neutral'}>
                  {hasCanvasChanges(brandingConfig) ? 'Configured' : 'Not ready'}
                </Badge>
              </div>
              <InspectorRow label="Watermark" value={brandingConfig.watermark.enabled ? 'Enabled' : 'Off'} />
              <InspectorRow label="Moving text" value={brandingConfig.movingText.enabled ? 'Enabled' : 'Off'} />
              <InspectorRow label="Side images" value={`${countSideImages(brandingConfig)} / 4`} />
              <InspectorRow label="Aspect ratio" value={formatAspectRatio(brandingConfig)} />
              <InspectorRow label="Video zoom" value={`${brandingConfig.canvas.zoomPercent}%`} />
              <InspectorRow label="Output size" value={formatOutputSize(branding.message)} />
              <InspectorRow label="Videos scanned" value={String(branding.totalVideos)} />
              <InspectorRow label="Output" value={branding.outputFolder ?? 'Default folder'} mono />
            </Panel>
            <Panel className="space-y-3 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">Render status</p>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <StatusDot tone={branding.status === 'processing' || branding.status === 'previewing' ? 'active' : branding.status === 'error' ? 'danger' : 'success'} />
                {branding.message ?? 'Ready for a preview or batch render.'}
              </div>
              {branding.totalVideos > 0 ? <ProgressBar value={branding.progressPercent} /> : null}
            </Panel>
          </>
        ) : null}

        {view === 'composer' ? (
          <>
            <div className="sticky top-0 z-10 -mx-1 min-h-[280px] bg-surface/95 pb-3 backdrop-blur-sm">
              {composerPreview}
            </div>
            <Panel className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-200">Project status</p>
                <Badge tone={composerVideoCount > 0 && composerAudioReady ? 'success' : 'neutral'}>
                  {composerVideoCount > 0 && composerAudioReady ? 'Ready to export' : 'Setup needed'}
                </Badge>
              </div>
              <InspectorRow label="Videos" value={String(composerVideoCount)} />
              <InspectorRow label="Audio" value={composerAudioReady ? 'Selected' : 'Not selected'} />
              <InspectorRow
                label="Watermark"
                value={composerBrandingConfig.watermark.enabled ? 'Enabled' : 'Off'}
              />
              <InspectorRow
                label="Moving text"
                value={composerBrandingConfig.movingText.enabled ? 'Enabled' : 'Off'}
              />
              <InspectorRow
                label="Side images"
                value={`${countSideImages(composerBrandingConfig)} / 4`}
              />
              <InspectorRow label="Output" value={composerOutputPath ?? 'Not set'} mono />
            </Panel>
            <Panel className="space-y-3 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">
                Current step
              </p>
              {composerProgress.stepIndex > 0 ? (
                <p className="text-xs font-medium text-sky-300">
                  Step {composerProgress.stepIndex}/{composerProgress.stepTotal}
                  {composerProgress.stepLabel ? ` — ${composerProgress.stepLabel}` : ''}
                </p>
              ) : null}
              {composerProgress.nextStepLabel ? (
                <p className="text-[11px] text-slate-500">
                  Next: {composerProgress.nextStepLabel}
                </p>
              ) : null}
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <StatusDot
                  tone={
                    composerIsWorking
                      ? 'active'
                      : composerProgress.status === 'error'
                        ? 'danger'
                        : composerProgress.status === 'completed'
                          ? 'success'
                          : 'neutral'
                  }
                />
                {composerActivityMessage ??
                  composerProgress.message ??
                  composerProgress.currentStep ??
                  'Add videos and audio to begin.'}
              </div>
              {composerIsWorking || composerProgress.progressPercent > 0 ? (
                <ProgressBar value={composerProgress.progressPercent} />
              ) : null}
              {composerProgress.encoder ? (
                <InspectorRow label="Encoder" value={composerProgress.encoder} />
              ) : (
                <InspectorRow label="Export mode" value="1080p HD" />
              )}
              {composerProgress.currentFile ? (
                <p className="truncate font-mono text-[11px] text-slate-500" title={composerProgress.currentFile}>
                  {composerProgress.currentFile}
                </p>
              ) : null}
            </Panel>
            <LogPanel logs={composerActivityLogs} title="Activity" compact />
          </>
        ) : null}

        {view === 'image-editor' ? (
          <>
            <div className="sticky top-0 z-10 -mx-1 bg-surface/95 pb-3 backdrop-blur-sm">
              {imageEditPreview}
            </div>
            <Panel className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-200">Edit summary</p>
                <Badge tone={imageEditReady(imageEditingConfig) ? 'success' : 'neutral'}>
                  {imageEditReady(imageEditingConfig) ? 'Configured' : 'Not ready'}
                </Badge>
              </div>
              <InspectorRow label="Preset" value={imageEditingConfig.presetName ?? 'None selected'} />
              <InspectorRow label="Crop" value={imageEditingConfig.cropMode} />
              <InspectorRow label="Side images" value={`${countImageEditSides(imageEditingConfig)} / 4`} />
              <InspectorRow label="Images scanned" value={String(imageEditing.totalImages)} />
              <InspectorRow label="Output format" value={imageEditingConfig.outputFormat.toUpperCase()} />
              <InspectorRow label="Output" value={imageEditing.outputFolder ?? 'Default folder'} mono />
            </Panel>
            <Panel className="space-y-3 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">
                Render status
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <StatusDot
                  tone={
                    imageEditing.status === 'processing' || imageEditing.status === 'previewing'
                      ? 'active'
                      : imageEditing.status === 'error'
                        ? 'danger'
                        : 'success'
                  }
                />
                {imageEditing.message ?? 'Choose an edit setting to begin.'}
              </div>
              {imageEditing.totalImages > 0 ? (
                <ProgressBar value={imageEditing.progressPercent} />
              ) : null}
            </Panel>
          </>
        ) : null}

        {view === 'activity' ? (
          <Panel className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <StatusDot tone={busy ? 'active' : 'success'} />
              <p className="text-xs font-semibold text-slate-200">{busy ? 'Processing in background' : 'No active job'}</p>
            </div>
            <InspectorRow label="Video job" value={processing.status} />
            <InspectorRow label="Classification" value={classification.status} />
            <InspectorRow label="Branding" value={branding.status} />
          </Panel>
        ) : null}

        {view === 'overview' ? (
          <Panel className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <Icon name="info" size={16} className="text-slate-400" />
              <p className="text-xs font-semibold text-slate-200">Session notes</p>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Work stays local. Originals are kept, and each workflow writes results beside its source folder.
            </p>
            <InspectorRow label="FFmpeg" value={processing.ffmpegAvailable ? 'Available' : 'Unavailable'} />
            <InspectorRow label="Frame folder" value={processing.selectedFolder ?? 'Not selected'} mono />
          </Panel>
        ) : null}
      </div>
    </div>
  );
});

function MiniMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <div className="rounded border border-surface-border bg-surface px-2 py-1.5">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={cx('mt-0.5 font-mono text-sm tabular-nums', tone === 'success' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : 'text-slate-200')}>
        {value}
      </p>
    </div>
  );
}

function InspectorRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className={cx('min-w-0 truncate text-right text-slate-300', mono && 'font-mono')} title={value}>
        {value}
      </span>
    </div>
  );
}

function countSideImages(config: BrandingConfig): number {
  return [config.canvas.top, config.canvas.bottom, config.canvas.left, config.canvas.right].filter(
    (side) => side.enabled,
  ).length;
}

function hasCanvasChanges(config: BrandingConfig): boolean {
  return (
    config.watermark.enabled ||
    config.movingText.enabled ||
    countSideImages(config) > 0 ||
    config.canvas.aspectRatio !== 'source' ||
    config.canvas.zoomPercent !== 100
  );
}

function formatAspectRatio(config: BrandingConfig): string {
  return config.canvas.aspectRatio === 'custom'
    ? `${config.canvas.customWidth}:${config.canvas.customHeight}`
    : config.canvas.aspectRatio === 'source'
      ? 'Original'
      : config.canvas.aspectRatio;
}

function formatOutputSize(message: string | null): string {
  return message?.match(/\b\d+x\d+\b/)?.[0] ?? 'Calculated on render';
}

function countImageEditSides(config: ImageEditConfig): number {
  return [config.canvas.top, config.canvas.bottom, config.canvas.left, config.canvas.right].filter(
    (side) => side.enabled,
  ).length;
}

function imageEditReady(config: ImageEditConfig): boolean {
  return (
    config.filter !== 'none' ||
    config.presetId !== null ||
    Object.values(config.tuning).some((value) => value !== 0) ||
    config.watermark.enabled ||
    countImageEditSides(config) > 0 ||
    config.canvas.aspectRatio !== 'source' ||
    config.canvas.zoomPercent !== 100 ||
    config.cropMode !== 'cover' ||
    config.outputFormat !== 'jpg' ||
    config.qualityPercent !== 92
  );
}

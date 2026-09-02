import { memo } from 'react';
import type { BrandingConfig, BrandingProgress } from '../../../shared/branding';
import type { ComposerProgress } from '../../../shared/composer';
import type { ImageClassificationProgress, LogEntry, ProcessingProgress } from '../../../shared/ipc';
import type { ImageEditConfig, ImageEditProgress } from '../../../shared/imageEditing';
import { Icon, Panel, ProgressBar, RangeField, SectionHeading, StatusDot } from '../ui/ui';
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
  composerProgress: ComposerProgress;
  composerActivityMessage: string | null;
  composerActivityLogs: LogEntry[];
  composerIsWorking: boolean;
  composerVideoCount: number;
  composerAudioReady: boolean;
  composerVideoOnly: boolean;
  composerOutputPath: string | null;
  composerBrandingConfig: BrandingConfig;
}

function InspectorHeader({ title, description }: { title: string; description: string }) {
  return <SectionHeading size="sm" title={title} description={description} />;
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
  composerProgress,
  composerActivityMessage,
  composerActivityLogs,
  composerIsWorking,
  composerVideoCount,
  composerAudioReady,
  composerVideoOnly,
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

  const composerReady = composerVideoCount > 0 && (composerVideoOnly || composerAudioReady);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="border-b border-surface-border px-4 py-3.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          Inspector
        </p>
        {view === 'frames' ? (
          <InspectorHeader title="Frame extraction" description="Selection and safety policy" />
        ) : view === 'classify' ? (
          <InspectorHeader title="Classification" description="Review split behavior" />
        ) : view === 'activity' ? (
          <InspectorHeader title="Run details" description="Live processing telemetry" />
        ) : (
          <InspectorHeader title="Workspace" description="System and session context" />
        )}
      </div>

      <div className="space-y-3 p-4">
        {view === 'frames' ? (
          <>
            <Panel className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <Icon name="frames" size={16} className="text-sky-300" />
                <p className="text-xs font-semibold text-slate-200">Detection policy</p>
              </div>
              <RangeField
                id="inspector-video-threshold"
                label="Allow threshold"
                value={videoAllowPercent}
                min={5}
                max={90}
                step={5}
                disabled={busy}
                onChange={onVideoAllowPercentChange}
                formatValue={(value) => `${value}%`}
                hint={`Scores above ${videoAllowPercent}% are sent to flagged output.`}
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
              <RangeField
                id="inspector-classify-threshold"
                label="Allow threshold"
                value={classifyAllowPercent}
                min={5}
                max={90}
                step={5}
                disabled={busy}
                onChange={onClassifyAllowPercentChange}
                formatValue={(value) => `${value}%`}
                hint={`Scores above ${classifyAllowPercent}% are sent to flagged output.`}
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

        {view === 'activity' ? (
          <Panel className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <StatusDot tone={busy ? 'active' : 'success'} />
              <p className="text-xs font-semibold text-slate-200">
                {busy ? 'Processing in background' : 'No active job'}
              </p>
            </div>
            <InspectorRow label="Video job" value={processing.status} />
            <InspectorRow label="Classification" value={classification.status} />
            <InspectorRow label="Branding" value={branding.status} />
            <InspectorRow label="Image editing" value={imageEditing.status} />
            <InspectorRow label="Combiner" value={composerProgress.status} />
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
            <InspectorRow
              label="Branding overlays"
              value={hasCanvasChanges(brandingConfig) ? 'Configured' : 'Default'}
            />
            <InspectorRow
              label="Image edit"
              value={imageEditReady(imageEditingConfig) ? 'Configured' : 'Default'}
            />
            <InspectorRow
              label="Combiner"
              value={
                composerReady
                  ? 'Ready'
                  : composerVideoCount > 0
                    ? 'Needs audio'
                    : 'Empty'
              }
            />
            {(composerIsWorking || composerProgress.progressPercent > 0) && (
              <>
                <ProgressBar value={composerProgress.progressPercent} />
                <p className="text-[11px] text-slate-500">
                  {composerActivityMessage ?? composerProgress.message ?? 'Combiner working…'}
                </p>
              </>
            )}
            {composerActivityLogs.length > 0 ? (
              <LogPanel logs={composerActivityLogs} title="Combiner activity" compact />
            ) : null}
            <InspectorRow
              label="Combiner branding"
              value={`${composerBrandingConfig.watermark.enabled ? 'WM' : '—'} · ${countSideImages(composerBrandingConfig)} sides`}
            />
            <InspectorRow label="Combiner out" value={composerOutputPath ?? 'Not set'} mono />
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
      <p
        className={cx(
          'mt-0.5 font-mono text-sm tabular-nums',
          tone === 'success'
            ? 'text-emerald-300'
            : tone === 'warning'
              ? 'text-amber-300'
              : 'text-slate-200',
        )}
      >
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

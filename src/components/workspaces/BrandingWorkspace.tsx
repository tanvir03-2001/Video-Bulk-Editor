import type { VideoBrandingController } from '../../hooks/useVideoBranding';
import { ResizableEditorSplit } from '../layout/ResizableEditorSplit';
import { BrandingPreview } from '../branding/BrandingPreview';
import { VideoBrandingPanel } from '../branding/VideoBrandingPanel';
import {
  AlertBanner,
  Badge,
  EditorChrome,
  Icon,
  ProgressBar,
  StatCard,
  StatusDot,
  ToolbarRow,
} from '../ui/ui';

export function BrandingWorkspace({ branding }: { branding: VideoBrandingController }) {
  const active =
    branding.progress.status === 'processing' || branding.progress.status === 'previewing';
  const finished = ['completed', 'preview_ready'].includes(branding.progress.status);

  return (
    <EditorChrome>
      <ToolbarRow className="justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              Production
            </p>
            <h2 className="truncate text-sm font-semibold text-white">Video Branding</h2>
          </div>
          <Badge tone={branding.videos.length > 0 ? 'success' : 'neutral'}>
            {branding.videos.length} video{branding.videos.length === 1 ? '' : 's'}
          </Badge>
          {!branding.configReady ? (
            <Badge tone="warning">Enable an overlay to preview</Badge>
          ) : null}
        </div>
        <div className="grid w-full max-w-xl grid-cols-3 gap-2 sm:w-auto">
          <StatCard
            compact
            label="Source"
            value={branding.videos.length}
            detail={branding.folder ? 'Folder set' : 'Select folder'}
            tone="accent"
          />
          <StatCard
            compact
            label="Output"
            value={branding.outputFolder ? 'Ready' : 'Default'}
            tone={branding.outputFolder ? 'success' : 'neutral'}
          />
          <StatCard compact label="Done" value={branding.progress.completedVideos} />
        </div>
      </ToolbarRow>

      {branding.error ? (
        <div className="shrink-0 px-3 pt-3 lg:px-4">
          <AlertBanner title="Branding action needs attention">{branding.error}</AlertBanner>
        </div>
      ) : null}

      <ResizableEditorSplit
        settings={<VideoBrandingPanel branding={branding} />}
        preview={
          <BrandingPreview
            progress={branding.progress}
            videos={branding.videos}
            previewVideoPath={branding.previewVideoPath}
            sourceVideoUrl={branding.sourceVideoUrl}
            previewUrl={branding.previewUrl}
            showInstantPreview={branding.showInstantPreview}
            showEncodedPreview={branding.showEncodedPreview}
            config={branding.config}
            outputFolder={branding.outputFolder}
            aspectRatio={branding.config.canvas.aspectRatio}
            customWidth={branding.config.canvas.customWidth}
            customHeight={branding.config.canvas.customHeight}
            zoomPercent={branding.config.canvas.zoomPercent}
            canPreview={branding.canPreview}
            canApply={branding.canApply}
            canCancel={branding.canCancel}
            onPreviewVideoChange={branding.setPreviewVideoPath}
            onGeneratePreview={() => {
              void branding.generatePreview();
            }}
            onApplyToAll={() => {
              void branding.applyToAll();
            }}
            onCancel={() => {
              void branding.cancel();
            }}
            onSelectOutputFolder={() => {
              void branding.selectOutputFolder();
            }}
            onResetOutputFolder={() => {
              void branding.resetOutputFolder();
            }}
          />
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-surface-border bg-surface-raised/60 px-3 py-2 lg:px-4">
        <div className="flex items-center gap-2">
          <Icon name="logo" size={14} className="text-sky-300" />
          <StatusDot
            tone={active ? 'active' : finished ? 'success' : branding.progress.failedVideos > 0 ? 'danger' : 'neutral'}
          />
          <span className="text-xs font-medium text-slate-300">
            {brandingStatusLabel(branding.progress.status)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <ProgressBar
            value={branding.progress.progressPercent}
            tone={branding.progress.failedVideos > 0 ? 'warning' : finished ? 'success' : 'accent'}
          />
        </div>
        <span className="font-mono text-xs tabular-nums text-slate-400">
          {Math.round(branding.progress.progressPercent)}%
        </span>
        <span className="hidden text-xs text-slate-500 sm:inline">
          {branding.progress.completedVideos}/{branding.progress.totalVideos || '—'}
        </span>
        {branding.progress.currentFile ? (
          <span
            className="hidden max-w-[200px] truncate font-mono text-[11px] text-slate-500 xl:inline"
            title={branding.progress.currentFile}
          >
            {branding.progress.currentFile}
          </span>
        ) : null}
      </div>
    </EditorChrome>
  );
}

function brandingStatusLabel(status: string): string {
  return status === 'no_videos'
    ? 'No videos'
    : status.replace('_', ' ').replace(/^\w/, (value) => value.toUpperCase());
}

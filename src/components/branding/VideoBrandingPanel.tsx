import type { VideoBrandingController } from '../../hooks/useVideoBranding';
import { BrandingPreview } from './BrandingPreview';
import { MovingTextSettings } from './MovingTextSettings';
import { WatermarkSettings } from './WatermarkSettings';
import { Badge, Button, Panel } from '../ui/ui';

interface VideoBrandingPanelProps {
  branding: VideoBrandingController;
}

export function VideoBrandingPanel({ branding }: VideoBrandingPanelProps) {
  const settingsDisabled =
    branding.isBranding ||
    branding.busy ||
    (!branding.canSelectFolder && !branding.canPreview && !branding.canApply);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          icon="folder"
          onClick={() => {
            void branding.selectFolder();
          }}
          disabled={!branding.canSelectFolder}
        >
          Select Folder
        </Button>
        <p
          className="min-w-0 flex-1 truncate rounded-md border border-surface-border bg-surface px-3 py-2 font-mono text-xs text-slate-400"
          title={branding.folder ?? undefined}
        >
          {branding.folder ?? 'No folder selected'}
        </p>
        {branding.videos.length > 0 ? (
          <Badge tone="success">
            {branding.videos.length} video{branding.videos.length === 1 ? '' : 's'}
          </Badge>
        ) : null}
      </div>

      {branding.error ? (
        <Panel className="border-rose-500/30 bg-rose-950/20 px-3 py-2 text-sm leading-relaxed text-rose-100" role="alert">
          {branding.error}
        </Panel>
      ) : null}

      {!branding.configReady ? (
        <p className="text-xs leading-relaxed text-slate-400">
          Enable Watermark or Moving Text (and pick a logo for Image Logo mode) to start the live
          preview.
        </p>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-3">
        <WatermarkSettings
          config={branding.config.watermark}
          disabled={settingsDisabled}
          onChange={branding.updateWatermark}
          onTextChange={branding.updateWatermarkText}
          onSelectLogo={() => {
            void branding.selectLogo();
          }}
        />

        <MovingTextSettings
          config={branding.config.movingText}
          disabled={settingsDisabled}
          onChange={branding.updateMovingText}
        />

        <BrandingPreview
          progress={branding.progress}
          videos={branding.videos}
          previewVideoPath={branding.previewVideoPath}
          previewUrl={branding.previewUrl}
          outputFolder={branding.outputFolder}
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
      </div>
    </div>
  );
}

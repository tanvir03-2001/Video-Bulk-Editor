import type { VideoBrandingController } from '../../hooks/useVideoBranding';
import { BrandingPreview } from './BrandingPreview';
import { CanvasSettings } from './CanvasSettings';
import { MovingTextSettings } from './MovingTextSettings';
import { SideImagesSettings } from './SideImagesSettings';
import { WatermarkSettings } from './WatermarkSettings';
import { Badge, Button, Panel } from '../ui/ui';

interface VideoBrandingPanelProps {
  branding: VideoBrandingController;
  showPreview?: boolean;
}

export function VideoBrandingPanel({ branding, showPreview = true }: VideoBrandingPanelProps) {
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
          Enable an overlay, side image, canvas format, or zoom to see the instant preview.
        </p>
      ) : null}

      <div
        className={
          showPreview
            ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]'
            : 'space-y-3'
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <CanvasSettings
              config={branding.config.canvas}
              disabled={settingsDisabled}
              onChange={branding.updateCanvas}
            />
            <SideImagesSettings
              config={branding.config.canvas}
              disabled={settingsDisabled}
              onChange={branding.updateSideImage}
              onSelectImage={branding.selectSideImage}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
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
          </div>
        </div>

        {showPreview ? (
          <div className="xl:sticky xl:top-4">
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
          </div>
        ) : null}
      </div>
    </div>
  );
}

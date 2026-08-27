import type { VideoBrandingController } from '../../hooks/useVideoBranding';
import { BrandingPreview } from './BrandingPreview';
import { MovingTextSettings } from './MovingTextSettings';
import { WatermarkSettings } from './WatermarkSettings';

interface VideoBrandingPanelProps {
  branding: VideoBrandingController;
}

export function VideoBrandingPanel({ branding }: VideoBrandingPanelProps) {
  const settingsDisabled = branding.isBranding || branding.busy;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void branding.selectFolder();
          }}
          disabled={!branding.canSelectFolder}
          className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium tracking-readable text-white transition hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Select Video Folder
        </button>
        <p
          className="min-w-0 flex-1 truncate font-mono text-sm text-slate-300"
          title={branding.folder ?? undefined}
        >
          {branding.folder ?? 'No folder selected'}
        </p>
        {branding.videos.length > 0 ? (
          <span className="text-sm text-emerald-300">
            {branding.videos.length} video{branding.videos.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      {branding.error ? (
        <p className="rounded-md border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-sm leading-relaxed text-rose-100">
          {branding.error}
        </p>
      ) : null}

      {!branding.configReady ? (
        <p className="text-xs leading-relaxed text-slate-400">
          Enable Watermark or Moving Text (and pick a logo for Image Logo mode) to generate a
          preview.
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
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

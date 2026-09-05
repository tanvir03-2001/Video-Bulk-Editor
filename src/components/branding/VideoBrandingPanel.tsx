import type { VideoBrandingController } from '../../hooks/useVideoBranding';
import { SettingsProfilePicker } from '../settings/SettingsProfilePicker';
import { CanvasSettings } from './CanvasSettings';
import { MovingTextSettings } from './MovingTextSettings';
import { SideImagesSettings } from './SideImagesSettings';
import { SubtitlesPositionControls } from './SubtitlesPositionControls';
import { SubtitleDesignPicker } from './SubtitleDesignPicker';
import { WatermarkSettings } from './WatermarkSettings';
import { PresetPicker } from '../imageEditing/PresetPicker';
import { Badge, Button, CheckboxField, Panel } from '../ui/ui';

interface VideoBrandingPanelProps {
  branding: VideoBrandingController;
}

export function VideoBrandingPanel({ branding }: VideoBrandingPanelProps) {
  const settingsDisabled =
    branding.isBranding ||
    branding.busy ||
    (!branding.canSelectFolder && !branding.canPreview && !branding.canApply);

  return (
    <div className="space-y-3">
      <SettingsProfilePicker profiles={branding.settingsProfiles} disabled={settingsDisabled} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          icon="folder"
          onClick={() => {
            void branding.selectFolder();
          }}
          disabled={!branding.canSelectFolder}
        >
          Select Folder
        </Button>
        <p
          className="min-w-0 flex-1 truncate rounded-md border border-surface-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-slate-400"
          title={branding.folder ?? undefined}
        >
          {branding.folder ?? 'No folder selected'}
        </p>
        {branding.videos.length > 0 ? (
          <Badge tone="success">{branding.videos.length}</Badge>
        ) : null}
      </div>

      {!branding.configReady ? (
        <p className="text-xs leading-relaxed text-slate-400">
          Enable an overlay, side image, canvas format, or zoom to see the instant preview.
        </p>
      ) : null}

      <div className="space-y-3">
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
        <PresetPicker
          value={branding.config.imagePreset}
          disabled={settingsDisabled}
          onChange={branding.updateImagePreset}
        />
        <Panel className="space-y-2.5 bg-surface p-3.5">
          <CheckboxField
            label="English subtitles (Local Whisper)"
            checked={branding.config.subtitles.enabled}
            disabled={settingsDisabled}
            onChange={(enabled) => {
              branding.updateSubtitles({ enabled });
            }}
            hint="Extracts speech from each video's audio and burns modern word-by-word captions."
          />
          <SubtitleDesignPicker
            value={branding.config.subtitles}
            disabled={settingsDisabled}
            onChange={branding.updateSubtitles}
          />
          <SubtitlesPositionControls
            value={branding.config.subtitles}
            disabled={settingsDisabled}
            onChange={branding.updateSubtitles}
          />
        </Panel>
      </div>
    </div>
  );
}

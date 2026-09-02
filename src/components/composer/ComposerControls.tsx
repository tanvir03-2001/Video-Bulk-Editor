import type { ComposerClip } from '../../../shared/composer';
import type { BrandingConfig, BrandingSide, WatermarkConfig } from '../../../shared/branding';
import { MovingTextSettings } from '../branding/MovingTextSettings';
import { SideImagesSettings } from '../branding/SideImagesSettings';
import { SubtitlesPositionControls } from '../branding/SubtitlesPositionControls';
import { WatermarkSettings } from '../branding/WatermarkSettings';
import { PresetPicker } from '../imageEditing/PresetPicker';
import {
  Badge,
  Button,
  CheckboxField,
  CollapsibleSection,
  Field,
  Panel,
  RangeField,
} from '../ui/ui';

interface ComposerControlsProps {
  selectedClip: ComposerClip | null;
  branding: BrandingConfig;
  outputPath: string | null;
  audioPath: string | null;
  disabled: boolean;
  onUpdateClip: (clipId: string, patch: Partial<ComposerClip>) => void;
  onUpdateWatermark: (patch: Partial<WatermarkConfig>) => void;
  onUpdateWatermarkText: (patch: Partial<WatermarkConfig['text']>) => void;
  onUpdateMovingText: (patch: Partial<BrandingConfig['movingText']>) => void;
  onUpdateSideImage: (side: BrandingSide, patch: Partial<BrandingConfig['canvas']['top']>) => void;
  onUpdateImagePreset: (next: BrandingConfig['imagePreset']) => void;
  onUpdateSubtitles: (patch: Partial<BrandingConfig['subtitles']>) => void;
  onSelectLogoImage: () => void;
  onSelectSideImage: (side: BrandingSide) => void;
  onSelectOutputPath: () => void;
}

export function ComposerControls({
  selectedClip,
  branding,
  outputPath,
  audioPath,
  disabled,
  onUpdateClip,
  onUpdateWatermark,
  onUpdateWatermarkText,
  onUpdateMovingText,
  onUpdateSideImage,
  onUpdateImagePreset,
  onUpdateSubtitles,
  onSelectLogoImage,
  onSelectSideImage,
  onSelectOutputPath,
}: ComposerControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">1080p HD</Badge>
        <Badge tone="neutral">Fade transitions</Badge>
      </div>

      <Panel className="space-y-3 bg-surface p-3.5">
        <p className="text-xs font-semibold text-slate-200">Clip audio</p>
        {selectedClip ? (
          <div className="space-y-3">
            <p className="truncate text-sm text-slate-200">{selectedClip.sourceName}</p>
            <CheckboxField
              label="Mute original audio"
              checked={selectedClip.muted}
              disabled={disabled}
              onChange={(muted) => {
                onUpdateClip(selectedClip.id, { muted });
              }}
            />
            <RangeField
              label="Volume"
              value={selectedClip.volumePercent}
              min={0}
              max={100}
              step={1}
              disabled={disabled || selectedClip.muted}
              onChange={(volumePercent) => {
                onUpdateClip(selectedClip.id, { volumePercent });
              }}
              formatValue={(value) => `${value}%`}
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500">Select a clip on the timeline to adjust volume.</p>
        )}
      </Panel>

      <Panel className="space-y-3 bg-surface p-3.5">
        <p className="text-xs font-semibold text-slate-200">Output</p>
        <Field label="Export path">
          <p className="truncate font-mono text-xs text-slate-400" title={outputPath ?? undefined}>
            {outputPath ?? 'Default videos folder'}
          </p>
        </Field>
        <Field label="Soundtrack">
          <p className="truncate font-mono text-xs text-slate-500" title={audioPath ?? undefined}>
            {audioPath ? audioPath.split(/[\\/]/).pop() : 'Not selected'}
          </p>
        </Field>
        <Button variant="secondary" size="sm" icon="folder" onClick={onSelectOutputPath} disabled={disabled}>
          Change Output
        </Button>
      </Panel>

      <CollapsibleSection title="Watermark" description="Logo or text overlay" defaultOpen>
        <WatermarkSettings
          bare
          config={branding.watermark}
          disabled={disabled}
          onChange={onUpdateWatermark}
          onTextChange={onUpdateWatermarkText}
          onSelectLogo={onSelectLogoImage}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Side images" description="Image bands around the frame">
        <SideImagesSettings
          bare
          config={branding.canvas}
          disabled={disabled}
          onChange={onUpdateSideImage}
          onSelectImage={onSelectSideImage}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Moving text" description="Animated text overlay">
        <MovingTextSettings
          bare
          config={branding.movingText}
          disabled={disabled}
          onChange={onUpdateMovingText}
        />
      </CollapsibleSection>

      <PresetPicker value={branding.imagePreset} disabled={disabled} onChange={onUpdateImagePreset} />

      <Panel className="space-y-2.5 bg-surface p-3.5">
        <CheckboxField
          label="English reels subtitles (Local Whisper)"
          checked={branding.subtitles.enabled}
          disabled={disabled}
          onChange={(enabled) => {
            onUpdateSubtitles({ enabled });
          }}
          hint="Uses the soundtrack when selected; otherwise speech from the combined video audio."
        />
        <SubtitlesPositionControls
          value={branding.subtitles}
          disabled={disabled}
          onChange={onUpdateSubtitles}
        />
      </Panel>
    </div>
  );
}

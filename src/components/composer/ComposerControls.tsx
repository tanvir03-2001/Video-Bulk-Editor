import { useState, type ReactNode } from 'react';
import type { ComposerClip } from '../../../shared/composer';
import type { BrandingConfig, BrandingSide, WatermarkConfig } from '../../../shared/branding';
import { MovingTextSettings } from '../branding/MovingTextSettings';
import { SideImagesSettings } from '../branding/SideImagesSettings';
import { WatermarkSettings } from '../branding/WatermarkSettings';
import { PresetPicker } from '../imageEditing/PresetPicker';
import { Icon } from '../ui/Icon';
import { Badge, Button, Panel } from '../ui/ui';

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

function SectionHeader({ icon, title }: { icon: Parameters<typeof Icon>[0]['name']; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} size={14} className="text-sky-400" />
      <p className="text-xs font-medium text-slate-300">{title}</p>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: Parameters<typeof Icon>[0]['name'];
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-surface-border bg-surface p-3.5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={onToggle}
      >
        <SectionHeader icon={icon} title={title} />
        <Icon
          name="chevron-down"
          size={14}
          className={`text-slate-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? children : null}
    </div>
  );
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
  const [watermarkOpen, setWatermarkOpen] = useState(true);
  const [sideImagesOpen, setSideImagesOpen] = useState(false);
  const [movingTextOpen, setMovingTextOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">1080p HD export</Badge>
        <Badge tone="neutral">Fade transitions</Badge>
        <span className="text-xs text-slate-500">Live branding preview in inspector</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="space-y-3 bg-surface p-3.5">
          <SectionHeader icon="play" title="Clip Audio" />
          {selectedClip ? (
            <div className="space-y-3">
              <p className="truncate text-sm text-slate-200">{selectedClip.sourceName}</p>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedClip.muted}
                  disabled={disabled}
                  onChange={(event) => {
                    onUpdateClip(selectedClip.id, { muted: event.target.checked });
                  }}
                />
                Mute original audio
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-400">
                  Volume ({selectedClip.volumePercent}%)
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={selectedClip.volumePercent}
                  disabled={disabled || selectedClip.muted}
                  onChange={(event) => {
                    onUpdateClip(selectedClip.id, {
                      volumePercent: Number(event.target.value),
                    });
                  }}
                  className="w-full"
                />
              </label>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select a clip on the timeline to adjust volume.</p>
          )}
        </Panel>

        <Panel className="space-y-3 bg-surface p-3.5">
          <SectionHeader icon="folder" title="Output" />
          <p className="truncate font-mono text-xs text-slate-400" title={outputPath ?? undefined}>
            {outputPath ?? 'Default videos folder'}
          </p>
          <p className="truncate font-mono text-xs text-slate-500" title={audioPath ?? undefined}>
            Audio: {audioPath ? audioPath.split(/[\\/]/).pop() : 'Not selected'}
          </p>
          <Button variant="secondary" size="sm" icon="folder" onClick={onSelectOutputPath} disabled={disabled}>
            Change Output
          </Button>
        </Panel>

        <div className="lg:col-span-2 space-y-3">
          <CollapsibleSection
            title="Watermark"
            icon="spark"
            open={watermarkOpen}
            onToggle={() => {
              setWatermarkOpen((open) => !open);
            }}
          >
            <WatermarkSettings
              config={branding.watermark}
              disabled={disabled}
              onChange={onUpdateWatermark}
              onTextChange={onUpdateWatermarkText}
              onSelectLogo={onSelectLogoImage}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Side images"
            icon="image"
            open={sideImagesOpen}
            onToggle={() => {
              setSideImagesOpen((open) => !open);
            }}
          >
            <SideImagesSettings
              config={branding.canvas}
              disabled={disabled}
              onChange={onUpdateSideImage}
              onSelectImage={onSelectSideImage}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Moving Text"
            icon="logo"
            open={movingTextOpen}
            onToggle={() => {
              setMovingTextOpen((open) => !open);
            }}
          >
            <MovingTextSettings
              config={branding.movingText}
              disabled={disabled}
              onChange={onUpdateMovingText}
            />
          </CollapsibleSection>

          <PresetPicker
            value={branding.imagePreset}
            disabled={disabled}
            onChange={onUpdateImagePreset}
          />

          <Panel className="space-y-2 bg-surface p-3.5">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={branding.subtitles.enabled}
                disabled={disabled}
                onChange={(event) => {
                  onUpdateSubtitles({ enabled: event.target.checked });
                }}
              />
              English reels subtitles (Local Whisper)
            </label>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Uses the soundtrack when selected; otherwise speech from the combined video audio.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

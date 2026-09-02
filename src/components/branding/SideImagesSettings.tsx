import {
  type BrandingCanvasConfig,
  type BrandingSide,
  type SideImageConfig,
} from '../../../shared/branding';
import { Badge, Button, Panel } from '../ui/ui';

interface SideImagesSettingsProps {
  config: BrandingCanvasConfig;
  disabled: boolean;
  onChange: (side: BrandingSide, patch: Partial<SideImageConfig>) => void;
  onSelectImage: (side: BrandingSide) => void;
  bare?: boolean;
}

const sideLabels: Record<BrandingSide, string> = {
  top: 'Top',
  bottom: 'Bottom',
  left: 'Left',
  right: 'Right',
};

const sideOrder: BrandingSide[] = ['top', 'bottom', 'left', 'right'];

export function SideImagesSettings({
  config,
  disabled,
  onChange,
  onSelectImage,
  bare = false,
}: SideImagesSettingsProps) {
  const enabledCount = sideOrder.filter((side) => config[side].enabled).length;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Side images</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Add one or more image bands around the video.
          </p>
        </div>
        <Badge tone={enabledCount > 0 ? 'accent' : 'neutral'}>{enabledCount} / 4</Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {sideOrder.map((side) => {
          const slot = config[side];
          return (
            <SideImageRow
              key={side}
              side={side}
              config={slot}
              disabled={disabled}
              onChange={onChange}
              onSelectImage={onSelectImage}
            />
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Top and bottom images scale to the canvas width. Left and right images scale to the video
        height; bands auto-fit to keep the video visible.
      </p>
    </>
  );

  if (bare) {
    return <div className="space-y-3">{body}</div>;
  }

  return <Panel className="space-y-3 bg-surface p-3.5">{body}</Panel>;
}

function SideImageRow({
  side,
  config,
  disabled,
  onChange,
  onSelectImage,
}: {
  side: BrandingSide;
  config: SideImageConfig;
  disabled: boolean;
  onChange: (side: BrandingSide, patch: Partial<SideImageConfig>) => void;
  onSelectImage: (side: BrandingSide) => void;
}) {
  return (
    <div className="rounded-md border border-surface-border bg-surface px-2.5 py-2">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-200">
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => {
            onChange(side, { enabled: event.target.checked });
          }}
          className="h-3.5 w-3.5 accent-accent disabled:opacity-40"
        />
        {sideLabels[side]} image
      </label>
      <Button
        size="sm"
        variant="secondary"
        icon="image"
        onClick={() => {
          onSelectImage(side);
        }}
        disabled={disabled}
        className="mt-2 w-full"
      >
        {config.imagePath ? 'Change image' : 'Choose image'}
      </Button>
      <p
        className="mt-1 truncate font-mono text-[10px] text-slate-500"
        title={config.imagePath ?? undefined}
      >
        {config.imagePath ?? 'No image selected'}
      </p>
    </div>
  );
}

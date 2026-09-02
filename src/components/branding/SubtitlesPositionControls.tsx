import {
  BRANDING_LIMITS,
  DEFAULT_BRANDING_SUBTITLES,
  type BrandingSubtitlesConfig,
} from '../../../shared/branding';
import { Button, Icon, IconButton } from '../ui/ui';

interface SubtitlesPositionControlsProps {
  value: BrandingSubtitlesConfig;
  disabled?: boolean;
  onChange: (patch: Partial<BrandingSubtitlesConfig>) => void;
}

function clampPosition(value: number): number {
  const { min, max } = BRANDING_LIMITS.subtitlePositionPercent;
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

export function SubtitlesPositionControls({
  value,
  disabled = false,
  onChange,
}: SubtitlesPositionControlsProps) {
  const step = BRANDING_LIMITS.subtitlePositionPercent.step;
  const xPercent = Number.isFinite(value.xPercent)
    ? value.xPercent
    : DEFAULT_BRANDING_SUBTITLES.xPercent;
  const yPercent = Number.isFinite(value.yPercent)
    ? value.yPercent
    : DEFAULT_BRANDING_SUBTITLES.yPercent;
  const controlsDisabled = disabled || !value.enabled;

  return (
    <div className="space-y-2 border-t border-surface-border pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-300">Caption position</p>
        <p className="font-mono text-[10px] text-slate-500">
          {xPercent.toFixed(0)}% · {yPercent.toFixed(0)}%
        </p>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <IconButton
          icon="chevron-up"
          label="Move captions up"
          size={34}
          disabled={controlsDisabled}
          className="border-surface-border bg-surface-raised text-slate-200"
          onClick={() => onChange({ yPercent: clampPosition(yPercent - step) })}
        />
        <div className="flex items-center gap-1.5">
          <IconButton
            icon="chevron-left"
            label="Move captions left"
            size={34}
            disabled={controlsDisabled}
            className="border-surface-border bg-surface-raised text-slate-200"
            onClick={() => onChange({ xPercent: clampPosition(xPercent - step) })}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={controlsDisabled}
            className="min-w-[4.75rem] gap-1 px-2"
            title="Center vertically"
            onClick={() => onChange({ yPercent: 50 })}
          >
            <Icon name="chevron-up" size={12} />
            <Icon name="chevron-down" size={12} />
            Vert
          </Button>
          <IconButton
            icon="chevron-right"
            label="Move captions right"
            size={34}
            disabled={controlsDisabled}
            className="border-surface-border bg-surface-raised text-slate-200"
            onClick={() => onChange({ xPercent: clampPosition(xPercent + step) })}
          />
        </div>
        <IconButton
          icon="chevron-down"
          label="Move captions down"
          size={34}
          disabled={controlsDisabled}
          className="border-surface-border bg-surface-raised text-slate-200"
          onClick={() => onChange({ yPercent: clampPosition(yPercent + step) })}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={controlsDisabled}
          className="mt-0.5 min-w-[7.5rem] gap-1"
          title="Center horizontally"
          onClick={() => onChange({ xPercent: 50 })}
        >
          <Icon name="chevron-left" size={12} />
          <Icon name="chevron-right" size={12} />
          Horizontal
        </Button>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Preview shows a demo caption at this spot. Export burns real Whisper captions here.
      </p>
    </div>
  );
}

import {
  DEFAULT_BRANDING_SUBTITLES,
  type BrandingSubtitlesConfig,
  type SubtitleDesignId,
} from '../../../shared/branding';
import { SUBTITLE_DESIGNS } from '../../../shared/subtitleDesigns';

interface SubtitleDesignPickerProps {
  value: BrandingSubtitlesConfig;
  disabled?: boolean;
  onChange: (patch: Partial<BrandingSubtitlesConfig>) => void;
}

function DesignSample({
  designId,
  focusColor,
}: {
  designId: SubtitleDesignId;
  focusColor: string;
}) {
  if (designId === 'cinematic-kinetic') {
    return (
      <p
        className="truncate text-center text-[11px] font-black uppercase leading-none tracking-tight text-white"
        style={{
          fontFamily: 'Impact, "Arial Black", Haettenschweiler, sans-serif',
          textShadow: '0 1px 2px rgba(0,0,0,0.85)',
        }}
      >
        <span>MAKE IT </span>
        <span
          className="inline-block scale-110"
          style={{
            color: focusColor,
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.9))',
          }}
        >
          POP
        </span>
      </p>
    );
  }

  return (
    <p
      className="truncate text-center text-[11px] font-black uppercase tracking-wide text-white"
      style={{
        fontFamily: '"Arial Black", Impact, sans-serif',
        WebkitTextStroke: '0.04em rgba(0,0,0,0.85)',
        paintOrder: 'stroke fill',
        textShadow: '0 1px 2px rgba(0,0,0,0.75)',
      }}
    >
      THIS IS <span style={{ color: focusColor }}>DEMO</span>
    </p>
  );
}

export function SubtitleDesignPicker({
  value,
  disabled = false,
  onChange,
}: SubtitleDesignPickerProps) {
  const selectedId = value.designId ?? DEFAULT_BRANDING_SUBTITLES.designId;
  const focusColor = value.focusColor ?? DEFAULT_BRANDING_SUBTITLES.focusColor;
  const controlsDisabled = disabled || !value.enabled;

  return (
    <div className="space-y-2 border-t border-surface-border pt-2.5">
      <p className="text-xs font-medium text-slate-300">Subtitle design</p>
      <div className="grid grid-cols-2 gap-2">
        {SUBTITLE_DESIGNS.map((design) => {
          const selected = design.id === selectedId;
          return (
            <button
              key={design.id}
              type="button"
              disabled={controlsDisabled}
              title={design.description}
              onClick={() => onChange({ designId: design.id })}
              className={[
                'flex flex-col gap-1.5 rounded-md border px-2 py-2 text-left transition',
                selected
                  ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
                  : 'border-surface-border bg-surface-raised hover:border-slate-500',
                controlsDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
              ].join(' ')}
            >
              <div className="flex h-9 items-center justify-center rounded bg-black/55 px-1">
                <DesignSample designId={design.id} focusColor={focusColor} />
              </div>
              <span className="text-[11px] font-semibold text-slate-200">{design.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <label htmlFor="subtitle-focus-color" className="text-xs font-medium text-slate-300">
          Focus colour
        </label>
        <input
          id="subtitle-focus-color"
          type="color"
          value={focusColor}
          disabled={controlsDisabled}
          onChange={(event) => {
            onChange({ focusColor: event.target.value });
          }}
          className="h-7 w-14 cursor-pointer rounded border border-surface-border bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          title="Active word highlight colour"
        />
      </div>
    </div>
  );
}

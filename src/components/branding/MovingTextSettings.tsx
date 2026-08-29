import {
  BRANDING_LIMITS,
  MOVING_TEXT_SPEEDS,
  type MovingTextConfig,
  type MovingTextSpeed,
} from '../../../shared/branding';
import { Panel } from '../ui/ui';

interface MovingTextSettingsProps {
  config: MovingTextConfig;
  disabled: boolean;
  onChange: (patch: Partial<MovingTextConfig>) => void;
}

const fieldLabel = 'text-xs font-medium text-slate-300';
const inputBase =
  'w-full rounded-md border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 outline-none transition focus:border-accent disabled:opacity-40';

const speedLabels: Record<MovingTextSpeed, string> = {
  'very-slow': 'Very Slow',
  slow: 'Slow',
  normal: 'Normal',
};

export function MovingTextSettings({ config, disabled, onChange }: MovingTextSettingsProps) {
  const controlsDisabled = disabled || !config.enabled;

  return (
    <Panel className="space-y-3 bg-surface p-3.5">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-100">
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => {
            onChange({ enabled: event.target.checked });
          }}
          className="h-4 w-4 accent-accent disabled:opacity-40"
        />
        Moving Text
      </label>

      <input
        type="text"
        value={config.text}
        disabled={controlsDisabled}
        maxLength={120}
        placeholder="Subtle brand text"
        onChange={(event) => {
          onChange({ text: event.target.value });
        }}
        className={inputBase}
      />

      <div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="mt-opacity" className={fieldLabel}>
            Opacity
          </label>
          <span className="font-mono text-xs tabular-nums text-white">{config.opacityPercent}%</span>
        </div>
        <input
          id="mt-opacity"
          type="range"
          min={BRANDING_LIMITS.movingTextOpacityPercent.min}
          max={BRANDING_LIMITS.movingTextOpacityPercent.max}
          step={BRANDING_LIMITS.movingTextOpacityPercent.step}
          value={config.opacityPercent}
          disabled={controlsDisabled}
          onChange={(event) => {
            onChange({ opacityPercent: Number(event.target.value) });
          }}
          className="mt-1 w-full accent-accent disabled:opacity-40"
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="mt-size" className={fieldLabel}>
            Text Size
          </label>
          <span className="font-mono text-xs tabular-nums text-white">
            {config.sizePercent}% height
          </span>
        </div>
        <input
          id="mt-size"
          type="range"
          min={BRANDING_LIMITS.movingTextSizePercent.min}
          max={BRANDING_LIMITS.movingTextSizePercent.max}
          step={BRANDING_LIMITS.movingTextSizePercent.step}
          value={config.sizePercent}
          disabled={controlsDisabled}
          onChange={(event) => {
            onChange({ sizePercent: Number(event.target.value) });
          }}
          className="mt-1 w-full accent-accent disabled:opacity-40"
        />
      </div>

      <div>
        <label htmlFor="mt-speed" className={fieldLabel}>
          Movement
        </label>
        <select
          id="mt-speed"
          value={config.speed}
          disabled={controlsDisabled}
          onChange={(event) => {
            onChange({ speed: event.target.value as MovingTextSpeed });
          }}
          className={`mt-1 ${inputBase}`}
        >
          {MOVING_TEXT_SPEEDS.map((speed) => (
            <option key={speed} value={speed}>
              {speedLabels[speed]}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        Drifts smoothly across the frame on a slow, looping path — no jumps, always fully inside
        the video.
      </p>
    </Panel>
  );
}

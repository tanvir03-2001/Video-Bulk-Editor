import {
  BRANDING_LIMITS,
  MOVING_TEXT_SPEEDS,
  type MovingTextConfig,
  type MovingTextSpeed,
} from '../../../shared/branding';
import { Field, Panel, RangeField, Select, TextInput } from '../ui/ui';

interface MovingTextSettingsProps {
  config: MovingTextConfig;
  disabled: boolean;
  onChange: (patch: Partial<MovingTextConfig>) => void;
  bare?: boolean;
}

const speedLabels: Record<MovingTextSpeed, string> = {
  'very-slow': 'Very Slow',
  slow: 'Slow',
  normal: 'Normal',
};

export function MovingTextSettings({
  config,
  disabled,
  onChange,
  bare = false,
}: MovingTextSettingsProps) {
  const controlsDisabled = disabled || !config.enabled;

  const body = (
    <>
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

      <Field label="Text" htmlFor="mt-text">
        <TextInput
          id="mt-text"
          type="text"
          value={config.text}
          disabled={controlsDisabled}
          maxLength={80}
          placeholder="Your moving message"
          onChange={(event) => {
            onChange({ text: event.target.value });
          }}
        />
      </Field>

      <RangeField
        id="mt-size"
        label="Size"
        value={config.sizePercent}
        min={BRANDING_LIMITS.movingTextSizePercent.min}
        max={BRANDING_LIMITS.movingTextSizePercent.max}
        step={BRANDING_LIMITS.movingTextSizePercent.step}
        disabled={controlsDisabled}
        onChange={(value) => {
          onChange({ sizePercent: value });
        }}
        formatValue={(value) => `${value}%`}
      />

      <RangeField
        id="mt-opacity"
        label="Opacity"
        value={config.opacityPercent}
        min={BRANDING_LIMITS.movingTextOpacityPercent.min}
        max={BRANDING_LIMITS.movingTextOpacityPercent.max}
        step={BRANDING_LIMITS.movingTextOpacityPercent.step}
        disabled={controlsDisabled}
        onChange={(value) => {
          onChange({ opacityPercent: value });
        }}
        formatValue={(value) => `${value}%`}
      />

      <Field label="Movement" htmlFor="mt-speed">
        <Select
          id="mt-speed"
          value={config.speed}
          disabled={controlsDisabled}
          onChange={(event) => {
            onChange({ speed: event.target.value as MovingTextSpeed });
          }}
        >
          {MOVING_TEXT_SPEEDS.map((speed) => (
            <option key={speed} value={speed}>
              {speedLabels[speed]}
            </option>
          ))}
        </Select>
      </Field>

      <p className="text-xs leading-relaxed text-slate-400">
        Drifts smoothly across the frame on a slow, looping path — no jumps, always fully inside the video.
      </p>
    </>
  );

  if (bare) {
    return <div className="space-y-3">{body}</div>;
  }

  return <Panel className="space-y-3 bg-surface p-3.5">{body}</Panel>;
}

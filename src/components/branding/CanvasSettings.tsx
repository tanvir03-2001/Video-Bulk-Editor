import {
  BRANDING_ASPECT_RATIO_LABELS,
  BRANDING_ASPECT_RATIOS,
  BRANDING_LIMITS,
  type BrandingAspectRatio,
  type BrandingCanvasConfig,
} from '../../../shared/branding';
import { Field, Panel, RangeField, Select, TextInput } from '../ui/ui';

interface CanvasSettingsProps {
  config: BrandingCanvasConfig;
  disabled: boolean;
  onChange: (patch: Partial<BrandingCanvasConfig>) => void;
  bare?: boolean;
}

export function CanvasSettings({ config, disabled, onChange, bare = false }: CanvasSettingsProps) {
  const custom = config.aspectRatio === 'custom';

  const body = (
    <>
      <div>
        <p className="text-sm font-semibold text-slate-100">Canvas & video</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Choose the output format and how tightly the source video fills it.
        </p>
      </div>

      <Field label="Output aspect ratio" htmlFor="branding-aspect-ratio">
        <Select
          id="branding-aspect-ratio"
          value={config.aspectRatio}
          disabled={disabled}
          onChange={(event) => {
            onChange({ aspectRatio: event.target.value as BrandingAspectRatio });
          }}
        >
          {BRANDING_ASPECT_RATIOS.map((ratio) => (
            <option key={ratio} value={ratio}>
              {BRANDING_ASPECT_RATIO_LABELS[ratio]}
            </option>
          ))}
        </Select>
      </Field>

      {custom ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width" htmlFor="branding-custom-width">
            <TextInput
              id="branding-custom-width"
              type="number"
              min={BRANDING_LIMITS.customRatio.min}
              max={BRANDING_LIMITS.customRatio.max}
              step={BRANDING_LIMITS.customRatio.step}
              value={config.customWidth}
              disabled={disabled}
              onChange={(event) => {
                onChange({ customWidth: Number(event.target.value) });
              }}
            />
          </Field>
          <Field label="Height" htmlFor="branding-custom-height">
            <TextInput
              id="branding-custom-height"
              type="number"
              min={BRANDING_LIMITS.customRatio.min}
              max={BRANDING_LIMITS.customRatio.max}
              step={BRANDING_LIMITS.customRatio.step}
              value={config.customHeight}
              disabled={disabled}
              onChange={(event) => {
                onChange({ customHeight: Number(event.target.value) });
              }}
            />
          </Field>
        </div>
      ) : null}

      <RangeField
        id="branding-zoom"
        label="Video zoom"
        value={config.zoomPercent}
        min={BRANDING_LIMITS.zoomPercent.min}
        max={BRANDING_LIMITS.zoomPercent.max}
        step={BRANDING_LIMITS.zoomPercent.step}
        disabled={disabled}
        onChange={(value) => {
          onChange({ zoomPercent: value });
        }}
        formatValue={(value) => `${value}%`}
        marks={
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>50% · Zoom out</span>
            <span>100% · Normal</span>
            <span>200% · Zoom in</span>
          </div>
        }
      />
    </>
  );

  if (bare) {
    return <div className="space-y-3">{body}</div>;
  }

  return <Panel className="space-y-3 bg-surface p-3.5">{body}</Panel>;
}

import {
  BRANDING_ASPECT_RATIO_LABELS,
  BRANDING_ASPECT_RATIOS,
  BRANDING_LIMITS,
  type BrandingAspectRatio,
  type BrandingCanvasConfig,
} from '../../../shared/branding';
import { Panel } from '../ui/ui';

interface CanvasSettingsProps {
  config: BrandingCanvasConfig;
  disabled: boolean;
  onChange: (patch: Partial<BrandingCanvasConfig>) => void;
}

const inputBase =
  'w-full rounded-md border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 outline-none transition focus:border-accent disabled:opacity-40';

export function CanvasSettings({ config, disabled, onChange }: CanvasSettingsProps) {
  const custom = config.aspectRatio === 'custom';

  return (
    <Panel className="space-y-3 bg-surface p-3.5">
      <div>
        <p className="text-sm font-semibold text-slate-100">Canvas & video</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Choose the output format and how tightly the source video fills it.
        </p>
      </div>

      <div>
        <label htmlFor="branding-aspect-ratio" className="text-xs font-medium text-slate-300">
          Output aspect ratio
        </label>
        <select
          id="branding-aspect-ratio"
          value={config.aspectRatio}
          disabled={disabled}
          onChange={(event) => {
            onChange({ aspectRatio: event.target.value as BrandingAspectRatio });
          }}
          className={`mt-1 ${inputBase}`}
        >
          {BRANDING_ASPECT_RATIOS.map((ratio) => (
            <option key={ratio} value={ratio}>
              {BRANDING_ASPECT_RATIO_LABELS[ratio]}
            </option>
          ))}
        </select>
      </div>

      {custom ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            Width
            <input
              type="number"
              min={BRANDING_LIMITS.customRatio.min}
              max={BRANDING_LIMITS.customRatio.max}
              step={BRANDING_LIMITS.customRatio.step}
              value={config.customWidth}
              disabled={disabled}
              onChange={(event) => {
                onChange({ customWidth: Number(event.target.value) });
              }}
              className={`mt-1 ${inputBase}`}
            />
          </label>
          <label className="text-xs text-slate-500">
            Height
            <input
              type="number"
              min={BRANDING_LIMITS.customRatio.min}
              max={BRANDING_LIMITS.customRatio.max}
              step={BRANDING_LIMITS.customRatio.step}
              value={config.customHeight}
              disabled={disabled}
              onChange={(event) => {
                onChange({ customHeight: Number(event.target.value) });
              }}
              className={`mt-1 ${inputBase}`}
            />
          </label>
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="branding-zoom" className="text-xs font-medium text-slate-300">
            Video zoom
          </label>
          <span className="font-mono text-xs tabular-nums text-sky-300">{config.zoomPercent}%</span>
        </div>
        <input
          id="branding-zoom"
          type="range"
          min={BRANDING_LIMITS.zoomPercent.min}
          max={BRANDING_LIMITS.zoomPercent.max}
          step={BRANDING_LIMITS.zoomPercent.step}
          value={config.zoomPercent}
          disabled={disabled}
          onChange={(event) => {
            onChange({ zoomPercent: Number(event.target.value) });
          }}
          className="mt-1 w-full accent-accent disabled:opacity-40"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-600">
          <span>50% · Zoom out</span>
          <span>100% · Normal</span>
          <span>200% · Zoom in</span>
        </div>
      </div>
    </Panel>
  );
}

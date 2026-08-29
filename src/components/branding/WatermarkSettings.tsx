import {
  BRANDING_FONT_FAMILIES,
  BRANDING_FONT_WEIGHTS,
  BRANDING_LIMITS,
  OVERLAY_POSITIONS,
  type BrandingFontFamily,
  type BrandingFontWeight,
  type OverlayPosition,
  type WatermarkConfig,
} from '../../../shared/branding';
import { Button, Panel } from '../ui/ui';

interface WatermarkSettingsProps {
  config: WatermarkConfig;
  disabled: boolean;
  onChange: (patch: Partial<WatermarkConfig>) => void;
  onTextChange: (patch: Partial<WatermarkConfig['text']>) => void;
  onSelectLogo: () => void;
}

const fieldLabel = 'text-xs font-medium text-slate-300';
const inputBase =
  'w-full rounded-md border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 outline-none transition focus:border-accent disabled:opacity-40';

const positionTitles: Record<OverlayPosition, string> = {
  'top-left': 'Top left',
  'top-center': 'Top center',
  'top-right': 'Top right',
  'center-left': 'Center left',
  center: 'Center',
  'center-right': 'Center right',
  'bottom-left': 'Bottom left',
  'bottom-center': 'Bottom center',
  'bottom-right': 'Bottom right',
};

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  disabled,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={fieldLabel}>
          {label}
        </label>
        <span className="font-mono text-xs tabular-nums text-white">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        className="mt-1 w-full accent-accent disabled:opacity-40"
      />
    </div>
  );
}

export function WatermarkSettings({
  config,
  disabled,
  onChange,
  onTextChange,
  onSelectLogo,
}: WatermarkSettingsProps) {
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
        Watermark
      </label>

      <div className="flex gap-3 border-b border-surface-border pb-2 text-xs text-slate-300">
        {(['image', 'text'] as const).map((mode) => (
          <label key={mode} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="watermark-mode"
              checked={config.mode === mode}
              disabled={controlsDisabled}
              onChange={() => {
                onChange({ mode });
              }}
              className="h-3.5 w-3.5 accent-accent disabled:opacity-40"
            />
            {mode === 'image' ? 'Image Logo' : 'Text Logo'}
          </label>
        ))}
      </div>

      {config.mode === 'image' ? (
        <div className="space-y-1.5">
          <Button
            size="sm"
            variant="secondary"
            icon="image"
            onClick={onSelectLogo}
            disabled={controlsDisabled}
          >
            Choose Logo Image
          </Button>
          <p
            className="truncate font-mono text-xs leading-relaxed text-slate-400"
            title={config.imagePath ?? undefined}
          >
            {config.imagePath ?? 'No logo selected (PNG with transparency works best)'}
          </p>
          <Slider
            id="wm-scale"
            label="Logo Size"
            value={config.scalePercent}
            min={BRANDING_LIMITS.watermarkScalePercent.min}
            max={BRANDING_LIMITS.watermarkScalePercent.max}
            step={BRANDING_LIMITS.watermarkScalePercent.step}
            disabled={controlsDisabled}
            suffix="% width"
            onChange={(value) => {
              onChange({ scalePercent: value });
            }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={config.text.text}
            disabled={controlsDisabled}
            maxLength={120}
            placeholder="Your brand name"
            onChange={(event) => {
              onTextChange({ text: event.target.value });
            }}
            className={inputBase}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={config.text.fontFamily}
              disabled={controlsDisabled}
              onChange={(event) => {
                onTextChange({ fontFamily: event.target.value as BrandingFontFamily });
              }}
              className={inputBase}
            >
              {BRANDING_FONT_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {family === 'sans' ? 'Sans' : family === 'serif' ? 'Serif' : 'Mono'}
                </option>
              ))}
            </select>
            <select
              value={config.text.fontWeight}
              disabled={controlsDisabled}
              onChange={(event) => {
                onTextChange({ fontWeight: event.target.value as BrandingFontWeight });
              }}
              className={inputBase}
            >
              {BRANDING_FONT_WEIGHTS.map((weight) => (
                <option key={weight} value={weight}>
                  {weight === 'regular' ? 'Regular' : weight === 'medium' ? 'Medium' : 'Bold'}
                </option>
              ))}
            </select>
          </div>
          <Slider
            id="wm-font-size"
            label="Text Size"
            value={config.text.fontSizePercent}
            min={BRANDING_LIMITS.textFontSizePercent.min}
            max={BRANDING_LIMITS.textFontSizePercent.max}
            step={BRANDING_LIMITS.textFontSizePercent.step}
            disabled={controlsDisabled}
            suffix="% height"
            onChange={(value) => {
              onTextChange({ fontSizePercent: value });
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="wm-color" className={fieldLabel}>
              Text Colour
            </label>
            <input
              id="wm-color"
              type="color"
              value={config.text.color}
              disabled={controlsDisabled}
              onChange={(event) => {
                onTextChange({ color: event.target.value });
              }}
              className="h-7 w-14 cursor-pointer rounded border border-surface-border bg-surface disabled:opacity-40"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={config.text.shadow}
              disabled={controlsDisabled}
              onChange={(event) => {
                onTextChange({ shadow: event.target.checked });
              }}
              className="h-4 w-4 accent-accent disabled:opacity-40"
            />
            Shadow / outline
          </label>
        </div>
      )}

      <div>
        <p className={fieldLabel}>Position</p>
        <div className="mt-1 grid w-fit grid-cols-3 gap-1">
          {OVERLAY_POSITIONS.map((position) => (
            <button
              key={position}
              type="button"
              title={positionTitles[position]}
              aria-label={positionTitles[position]}
              disabled={controlsDisabled}
              onClick={() => {
                onChange({ position });
              }}
              className={`h-6 w-8 rounded border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                config.position === position
                  ? 'border-accent bg-accent'
                  : 'border-surface-border bg-surface-raised hover:border-accent-muted'
              }`}
            />
          ))}
        </div>
      </div>

      <Slider
        id="wm-opacity"
        label="Opacity"
        value={config.opacityPercent}
        min={BRANDING_LIMITS.watermarkOpacityPercent.min}
        max={BRANDING_LIMITS.watermarkOpacityPercent.max}
        step={BRANDING_LIMITS.watermarkOpacityPercent.step}
        disabled={controlsDisabled}
        suffix="%"
        onChange={(value) => {
          onChange({ opacityPercent: value });
        }}
      />

      <Slider
        id="wm-margin"
        label="Edge Margin"
        value={config.marginPercent}
        min={BRANDING_LIMITS.watermarkMarginPercent.min}
        max={BRANDING_LIMITS.watermarkMarginPercent.max}
        step={BRANDING_LIMITS.watermarkMarginPercent.step}
        disabled={controlsDisabled}
        suffix="%"
        onChange={(value) => {
          onChange({ marginPercent: value });
        }}
      />
    </Panel>
  );
}

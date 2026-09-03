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
import { Button, CheckboxField, Field, Panel, RangeField, Select, TextInput } from '../ui/ui';
import { cx } from '../ui/cx';

interface WatermarkSettingsProps {
  config: WatermarkConfig;
  disabled: boolean;
  onChange: (patch: Partial<WatermarkConfig>) => void;
  onTextChange: (patch: Partial<WatermarkConfig['text']>) => void;
  onSelectLogo: () => void;
  bare?: boolean;
}

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

export function WatermarkSettings({
  config,
  disabled,
  onChange,
  onTextChange,
  onSelectLogo,
  bare = false,
}: WatermarkSettingsProps) {
  const controlsDisabled = disabled || !config.enabled;

  const body = (
    <>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-100">
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => {
            const enabled = event.target.checked;
            if (enabled && config.mode === 'image' && !config.imagePath) {
              onChange({ enabled, mode: 'text' });
              return;
            }
            onChange({ enabled });
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
        <div className="space-y-2">
          <Button size="sm" variant="secondary" icon="image" onClick={onSelectLogo} disabled={controlsDisabled}>
            Choose Logo Image
          </Button>
          <p
            className="truncate font-mono text-xs leading-relaxed text-slate-400"
            title={config.imagePath ?? undefined}
          >
            {config.imagePath ?? 'No logo selected (PNG with transparency works best)'}
          </p>
          <RangeField
            id="wm-scale"
            label="Logo Size"
            value={config.scalePercent}
            min={BRANDING_LIMITS.watermarkScalePercent.min}
            max={BRANDING_LIMITS.watermarkScalePercent.max}
            step={BRANDING_LIMITS.watermarkScalePercent.step}
            disabled={controlsDisabled}
            onChange={(value) => {
              onChange({ scalePercent: value });
            }}
            formatValue={(value) => `${value}%`}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Field label="Primary text" htmlFor="wm-primary-text">
            <TextInput
              id="wm-primary-text"
              type="text"
              value={config.text.text}
              disabled={controlsDisabled}
              maxLength={120}
              placeholder="Smooth"
              onChange={(event) => {
                onTextChange({ text: event.target.value });
              }}
            />
          </Field>
          <Field label="Secondary text (optional)" htmlFor="wm-secondary-text">
            <TextInput
              id="wm-secondary-text"
              type="text"
              value={config.text.secondaryText}
              disabled={controlsDisabled}
              maxLength={120}
              placeholder="Radio"
              onChange={(event) => {
                onTextChange({ secondaryText: event.target.value });
              }}
            />
          </Field>
          <div
            className="rounded-md border border-surface-border bg-black/30 px-3 py-2.5 text-right"
            aria-label="Text logo preview"
            style={{
              fontFamily:
                config.text.fontFamily === 'serif'
                  ? 'Georgia, serif'
                  : config.text.fontFamily === 'mono'
                    ? 'Consolas, monospace'
                    : 'Roboto, sans-serif',
              fontWeight: config.text.fontWeight === 'regular' ? 400 : config.text.fontWeight === 'medium' ? 600 : 800,
              color: config.text.color,
            }}
          >
            <p
              className="leading-none tracking-tight"
              style={{ fontSize: `${10 + config.text.fontSizePercent * 2}px` }}
            >
              {config.text.text || 'Smooth'}
            </p>
            {config.text.secondaryText ? (
              <p
                className="mt-1 leading-none"
                style={{ fontSize: `${8 + config.text.secondaryFontSizePercent * 2}px` }}
              >
                {config.text.secondaryText}
              </p>
            ) : null}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Primary/secondary sizes set lockup typography. Logo size sets overall width on the
            video (preview matches export).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={config.text.fontFamily}
              disabled={controlsDisabled}
              onChange={(event) => {
                onTextChange({ fontFamily: event.target.value as BrandingFontFamily });
              }}
            >
              {BRANDING_FONT_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {family === 'sans' ? 'Sans' : family === 'serif' ? 'Serif' : 'Mono'}
                </option>
              ))}
            </Select>
            <Select
              value={config.text.fontWeight}
              disabled={controlsDisabled}
              onChange={(event) => {
                onTextChange({ fontWeight: event.target.value as BrandingFontWeight });
              }}
            >
              {BRANDING_FONT_WEIGHTS.map((weight) => (
                <option key={weight} value={weight}>
                  {weight === 'regular' ? 'Regular' : weight === 'medium' ? 'Medium' : 'Bold'}
                </option>
              ))}
            </Select>
          </div>
          <RangeField
            id="wm-primary-font-size"
            label="Primary Text Size"
            value={config.text.fontSizePercent}
            min={BRANDING_LIMITS.textFontSizePercent.min}
            max={BRANDING_LIMITS.textFontSizePercent.max}
            step={BRANDING_LIMITS.textFontSizePercent.step}
            disabled={controlsDisabled}
            onChange={(value) => {
              onTextChange({ fontSizePercent: value });
            }}
            formatValue={(value) => `${value}%`}
          />
          <RangeField
            id="wm-secondary-font-size"
            label="Secondary Text Size"
            value={config.text.secondaryFontSizePercent}
            min={BRANDING_LIMITS.secondaryTextFontSizePercent.min}
            max={BRANDING_LIMITS.secondaryTextFontSizePercent.max}
            step={BRANDING_LIMITS.secondaryTextFontSizePercent.step}
            disabled={controlsDisabled || !config.text.secondaryText.trim()}
            onChange={(value) => {
              onTextChange({ secondaryFontSizePercent: value });
            }}
            formatValue={(value) => `${value}%`}
          />
          <RangeField
            id="wm-text-logo-size"
            label="Logo Size"
            value={config.scalePercent}
            min={BRANDING_LIMITS.watermarkScalePercent.min}
            max={BRANDING_LIMITS.watermarkScalePercent.max}
            step={BRANDING_LIMITS.watermarkScalePercent.step}
            disabled={controlsDisabled}
            onChange={(value) => {
              onChange({ scalePercent: value });
            }}
            formatValue={(value) => `${value}%`}
            hint="Overall text-logo width relative to the video frame."
          />
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="wm-color" className="text-xs font-medium text-slate-300">
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
          <CheckboxField
            label="Shadow / outline"
            checked={config.text.shadow}
            disabled={controlsDisabled}
            onChange={(shadow) => {
              onTextChange({ shadow });
            }}
          />
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-300">Position</p>
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
              className={cx(
                'h-6 w-8 rounded border transition disabled:cursor-not-allowed disabled:opacity-40',
                config.position === position
                  ? 'border-accent bg-accent'
                  : 'border-surface-border bg-surface-raised hover:border-accent-muted',
              )}
            />
          ))}
        </div>
      </div>

      <RangeField
        id="wm-opacity"
        label="Opacity"
        value={config.opacityPercent}
        min={BRANDING_LIMITS.watermarkOpacityPercent.min}
        max={BRANDING_LIMITS.watermarkOpacityPercent.max}
        step={BRANDING_LIMITS.watermarkOpacityPercent.step}
        disabled={controlsDisabled}
        onChange={(value) => {
          onChange({ opacityPercent: value });
        }}
        formatValue={(value) => `${value}%`}
      />

      <RangeField
        id="wm-margin"
        label="Edge Margin"
        value={config.marginPercent}
        min={BRANDING_LIMITS.watermarkMarginPercent.min}
        max={BRANDING_LIMITS.watermarkMarginPercent.max}
        step={BRANDING_LIMITS.watermarkMarginPercent.step}
        disabled={controlsDisabled}
        onChange={(value) => {
          onChange({ marginPercent: value });
        }}
        formatValue={(value) => `${value}%`}
      />
    </>
  );

  if (bare) {
    return <div className="space-y-3">{body}</div>;
  }

  return <Panel className="space-y-3 bg-surface p-3.5">{body}</Panel>;
}

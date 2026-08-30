import { useEffect, useMemo, useState } from 'react';
import {
  IMAGE_EDIT_ASPECT_RATIO_LABELS,
  IMAGE_EDIT_ASPECT_RATIOS,
  IMAGE_EDIT_CROP_MODE_LABELS,
  IMAGE_EDIT_CROP_MODES,
  IMAGE_EDIT_LIMITS,
  type ImageEditConfig,
  type ImageEditPresetSummary,
} from '../../../shared/imageEditing';
import {
  OVERLAY_POSITIONS,
  type BrandingAspectRatio,
  type BrandingSide,
} from '../../../shared/branding';
import type { ImageEditingController } from '../../hooks/useImageEditing';
import { Badge, Button, Icon, Panel } from '../ui/ui';

const inputBase =
  'w-full rounded-md border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 outline-none transition focus:border-accent disabled:opacity-40';

const sideLabels: Record<BrandingSide, string> = {
  top: 'Top',
  bottom: 'Bottom',
  left: 'Left',
  right: 'Right',
};

export function ImageEditingPanel({ editor }: { editor: ImageEditingController }) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const disabled = editor.isEditing || editor.busy || !editor.canSelectFolder;
  const custom = editor.config.canvas.aspectRatio === 'custom';
  const enabledSides = (['top', 'bottom', 'left', 'right'] as BrandingSide[]).filter(
    (side) => editor.config.canvas[side].enabled,
  ).length;

  return (
    <div className="space-y-3">
      <div>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-surface-border bg-surface-raised px-3 py-2.5 text-left transition hover:border-accent/50 hover:bg-surface-hover"
          aria-expanded={presetsOpen}
          onClick={() => setPresetsOpen((open) => !open)}
        >
          <span>
            <span className="block text-sm font-semibold text-slate-100">Preset library</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Choose from the bundled Lightroom-style film and creative looks.
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Badge tone={editor.config.presetId ? 'success' : 'neutral'}>
              {editor.presets.length || '…'}
            </Badge>
            <span className="text-xs text-slate-400">{presetsOpen ? 'Hide' : 'Show'}</span>
          </span>
        </button>
        {presetsOpen ? <PresetLibrary editor={editor} disabled={disabled} /> : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel className="space-y-3 bg-surface p-3.5">
          <div>
            <p className="text-sm font-semibold text-slate-100">Canvas & crop</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Choose the output frame and how the source image fills it.
            </p>
          </div>
          <label className="text-xs font-medium text-slate-300">
            Output aspect ratio
            <select
              value={editor.config.canvas.aspectRatio}
              disabled={disabled}
              onChange={(event) => {
                editor.updateCanvas({
                  aspectRatio: event.target.value as BrandingAspectRatio,
                });
              }}
              className={`mt-1 ${inputBase}`}
            >
              {IMAGE_EDIT_ASPECT_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {IMAGE_EDIT_ASPECT_RATIO_LABELS[ratio]}
                </option>
              ))}
            </select>
          </label>
          {custom ? (
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Width"
                value={editor.config.canvas.customWidth}
                disabled={disabled}
                min={IMAGE_EDIT_LIMITS.customRatio.min}
                max={IMAGE_EDIT_LIMITS.customRatio.max}
                onChange={(value) => editor.updateCanvas({ customWidth: value })}
              />
              <NumberField
                label="Height"
                value={editor.config.canvas.customHeight}
                disabled={disabled}
                min={IMAGE_EDIT_LIMITS.customRatio.min}
                max={IMAGE_EDIT_LIMITS.customRatio.max}
                onChange={(value) => editor.updateCanvas({ customHeight: value })}
              />
            </div>
          ) : null}
          <label className="text-xs font-medium text-slate-300">
            Crop behavior
            <select
              value={editor.config.cropMode}
              disabled={disabled}
              onChange={(event) => {
                editor.updateConfig({ cropMode: event.target.value as ImageEditConfig['cropMode'] });
              }}
              className={`mt-1 ${inputBase}`}
            >
              {IMAGE_EDIT_CROP_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {IMAGE_EDIT_CROP_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <RangeField
            id="image-edit-zoom"
            label="Image zoom"
            value={editor.config.canvas.zoomPercent}
            suffix="%"
            min={IMAGE_EDIT_LIMITS.zoomPercent.min}
            max={IMAGE_EDIT_LIMITS.zoomPercent.max}
            step={IMAGE_EDIT_LIMITS.zoomPercent.step}
            disabled={disabled}
            onChange={(value) => editor.updateCanvas({ zoomPercent: value })}
          />
        </Panel>

        <Panel className="space-y-3 bg-surface p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">Side images</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Add full-width or full-height image bands around every output.
              </p>
            </div>
            <Badge tone={enabledSides > 0 ? 'accent' : 'neutral'}>{enabledSides} / 4</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['top', 'bottom', 'left', 'right'] as BrandingSide[]).map((side) => {
              const slot = editor.config.canvas[side];
              return (
                <div key={side} className="rounded-md border border-surface-border bg-surface px-2.5 py-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-200">
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      disabled={disabled}
                      onChange={(event) => {
                        editor.updateSideImage(side, { enabled: event.target.checked });
                      }}
                      className="h-3.5 w-3.5 accent-accent disabled:opacity-40"
                    />
                    {sideLabels[side]} image
                  </label>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="image"
                    disabled={disabled}
                    onClick={() => {
                      void editor.selectSideImage(side);
                    }}
                    className="mt-2 w-full"
                  >
                    {slot.imagePath ? 'Change image' : 'Choose image'}
                  </Button>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-500" title={slot.imagePath ?? undefined}>
                    {slot.imagePath ?? 'No image selected'}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel className="space-y-3 bg-surface p-3.5">
          <div>
            <p className="text-sm font-semibold text-slate-100">Watermark logo</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Place a logo above the edited image and any side bands.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <input
              type="checkbox"
              checked={editor.config.watermark.enabled}
              disabled={disabled}
              onChange={(event) => editor.updateWatermark({ enabled: event.target.checked })}
              className="h-3.5 w-3.5 accent-accent disabled:opacity-40"
            />
            Enable watermark
          </label>
          <Button
            size="sm"
            variant="secondary"
            icon="image"
            disabled={disabled}
            onClick={() => {
              void editor.selectWatermark();
            }}
            className="w-full"
          >
            {editor.config.watermark.imagePath ? 'Change logo' : 'Choose logo'}
          </Button>
          <p className="truncate font-mono text-[10px] text-slate-500" title={editor.config.watermark.imagePath ?? undefined}>
            {editor.config.watermark.imagePath ?? 'No logo selected'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              Position
              <select
                value={editor.config.watermark.position}
                disabled={disabled}
                onChange={(event) => editor.updateWatermark({ position: event.target.value as ImageEditConfig['watermark']['position'] })}
                className={`mt-1 ${inputBase}`}
              >
                {OVERLAY_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position.replace('-', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <RangeField
              id="image-edit-watermark-scale"
              label="Scale"
              value={editor.config.watermark.scalePercent}
              suffix="%"
              min={IMAGE_EDIT_LIMITS.watermarkScalePercent.min}
              max={IMAGE_EDIT_LIMITS.watermarkScalePercent.max}
              step={IMAGE_EDIT_LIMITS.watermarkScalePercent.step}
              disabled={disabled}
              onChange={(value) => editor.updateWatermark({ scalePercent: value })}
            />
          </div>
          <RangeField
            id="image-edit-watermark-opacity"
            label="Opacity"
            value={editor.config.watermark.opacityPercent}
            suffix="%"
            min={IMAGE_EDIT_LIMITS.watermarkOpacityPercent.min}
            max={IMAGE_EDIT_LIMITS.watermarkOpacityPercent.max}
            step={IMAGE_EDIT_LIMITS.watermarkOpacityPercent.step}
            disabled={disabled}
            onChange={(value) => editor.updateWatermark({ opacityPercent: value })}
          />
        </Panel>

        <Panel className="space-y-3 bg-surface p-3.5">
          <div>
            <p className="text-sm font-semibold text-slate-100">Color grading & image tuning</p>
            <p className="mt-0.5 text-xs text-slate-500">
              These adjustments are applied consistently to every image in the batch.
            </p>
          </div>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <TuningRange editor={editor} field="brightnessPercent" label="Brightness" />
            <TuningRange editor={editor} field="contrastPercent" label="Contrast" />
            <TuningRange editor={editor} field="saturationPercent" label="Saturation" />
            <TuningRange editor={editor} field="temperaturePercent" label="Temperature" />
            <TuningRange editor={editor} field="hueDegrees" label="Hue" suffix="°" />
            <TuningRange editor={editor} field="sharpenPercent" label="Sharpen" />
          </div>
        </Panel>
      </div>

      <Panel className="space-y-3 bg-surface p-3.5">
        <div>
          <p className="text-sm font-semibold text-slate-100">Output</p>
          <p className="mt-0.5 text-xs text-slate-500">Original files remain untouched.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-300">
            Format
            <select
              value={editor.config.outputFormat}
              disabled={disabled}
              onChange={(event) => editor.updateConfig({ outputFormat: event.target.value as ImageEditConfig['outputFormat'] })}
              className={`mt-1 ${inputBase}`}
            >
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
              <option value="webp">WEBP</option>
            </select>
          </label>
          <RangeField
            id="image-edit-quality"
            label="Quality"
            value={editor.config.qualityPercent}
            suffix="%"
            min={IMAGE_EDIT_LIMITS.qualityPercent.min}
            max={IMAGE_EDIT_LIMITS.qualityPercent.max}
            step={IMAGE_EDIT_LIMITS.qualityPercent.step}
            disabled={disabled}
            onChange={(value) => editor.updateConfig({ qualityPercent: value })}
          />
        </div>
      </Panel>
    </div>
  );
}

function PresetLibrary({
  editor,
  disabled,
}: {
  editor: ImageEditingController;
  disabled: boolean;
}) {
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const groups = useMemo(
    () => Array.from(new Set(editor.presets.map((preset) => preset.group))),
    [editor.presets],
  );
  const favoritePresets = editor.presets.filter((preset) =>
    editor.favoritePresetIds.includes(preset.id),
  );
  const groupOptions = useMemo(
    () => (favoritePresets.length > 0 ? ['Favorites', ...groups] : groups),
    [favoritePresets.length, groups],
  );
  const selectedPresets = useMemo(
    () =>
      selectedGroup === 'Favorites'
        ? favoritePresets
        : editor.presets.filter((preset) => preset.group === selectedGroup),
    [editor.presets, favoritePresets, selectedGroup],
  );
  const visiblePresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return selectedPresets;
    }
    return selectedPresets.filter(
      (preset) =>
        preset.name.toLowerCase().includes(normalizedQuery) ||
        preset.group.toLowerCase().includes(normalizedQuery),
    );
  }, [query, selectedPresets]);

  useEffect(() => {
    setSelectedGroup((current) =>
      groupOptions.includes(current) ? current : groupOptions[0] ?? '',
    );
  }, [groupOptions]);

  return (
    <Panel className="mt-2 space-y-2.5 bg-surface p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-slate-500">
            {editor.config.presetName ? `Selected: ${editor.config.presetName}` : 'Select a look to apply'}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-600">
            {visiblePresets.length} of {selectedPresets.length} shown
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon="folder"
          disabled={disabled || editor.presetsLoading}
          onClick={() => {
            void editor.importPresets();
          }}
        >
          Import folder
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="sr-only" htmlFor="image-edit-preset-search">
          Search presets
        </label>
        <input
          id="image-edit-preset-search"
          value={query}
          disabled={disabled || editor.presetsLoading}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search presets…"
          className={inputBase}
        />
        <label className="sr-only" htmlFor="image-edit-preset-group">
          Preset category
        </label>
        <select
          id="image-edit-preset-group"
          value={selectedGroup}
          disabled={disabled || editor.presetsLoading || groupOptions.length === 0}
          onChange={(event) => setSelectedGroup(event.target.value)}
          className={inputBase}
        >
          {groupOptions.length === 0 ? <option value="">No categories</option> : null}
          {groupOptions.map((group) => (
            <option key={group} value={group}>
              {group}
              {group === 'Favorites'
                ? ` (${favoritePresets.length})`
                : ` (${editor.presets.filter((preset) => preset.group === group).length})`}
            </option>
          ))}
        </select>
      </div>
      {editor.presetsLoading ? (
        <p className="px-1 py-2 text-xs text-slate-500">Loading preset library…</p>
      ) : editor.presetsError ? (
        <p className="px-1 py-2 text-xs text-rose-300">{editor.presetsError}</p>
      ) : groupOptions.length === 0 ? (
        <p className="px-1 py-2 text-xs text-slate-500">No presets found. Import an XMP folder to begin.</p>
      ) : visiblePresets.length === 0 ? (
        <p className="px-1 py-2 text-xs text-slate-500">No presets match your search.</p>
      ) : (
        <div className="grid max-h-72 gap-1.5 overflow-y-auto border-t border-surface-border pt-2 sm:grid-cols-2">
          {visiblePresets.map((preset) => (
            <PresetButton
              key={preset.id}
              preset={preset}
              editor={editor}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function PresetButton({
  preset,
  editor,
  disabled,
}: {
  preset: ImageEditPresetSummary;
  editor: ImageEditingController;
  disabled: boolean;
}) {
  const loadPresetPreview = editor.loadPresetPreview;
  useEffect(() => {
    void loadPresetPreview(preset.id);
  }, [loadPresetPreview, preset.id]);

  const previewUrl = editor.presetPreviewUrls[preset.id];
  const isSelected = editor.config.presetId === preset.id;
  const isFavorite = editor.favoritePresetIds.includes(preset.id);
  return (
    <div
      className={`flex min-h-14 items-center gap-1 rounded-md border bg-surface transition ${
        isSelected
          ? 'border-accent/60 bg-accent/10'
          : 'border-surface-border hover:border-accent/30'
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => editor.applyPreset(preset)}
        className={`flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1 text-left text-[11px] transition ${
          isSelected
            ? 'text-sky-200'
            : 'text-slate-400 hover:text-slate-200'
        } disabled:cursor-not-allowed disabled:opacity-40`}
        title={preset.id}
      >
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded border border-surface-border bg-surface-raised">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
          <span className="flex h-full items-center justify-center text-[9px] text-slate-600">
            {editor.presetPreviewLoading[preset.id] ? '…' : '—'}
          </span>
          )}
        </span>
        <span className="line-clamp-2">{preset.name}</span>
      </button>
      <button
        type="button"
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={() => editor.togglePresetFavorite(preset.id)}
        className={`mr-1 rounded p-1 transition hover:bg-surface-hover ${
          isFavorite ? 'text-amber-300' : 'text-slate-600 hover:text-slate-300'
        }`}
      >
        <Icon name="star" size={13} />
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs text-slate-500">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`mt-1 ${inputBase}`}
      />
    </label>
  );
}

function RangeField({
  id,
  label,
  value,
  suffix = '',
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-slate-300">
          {label}
        </label>
        <span className="font-mono text-xs tabular-nums text-sky-300">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-accent disabled:opacity-40"
      />
    </div>
  );
}

function TuningRange({
  editor,
  field,
  label,
  suffix = '%',
}: {
  editor: ImageEditingController;
  field: keyof ImageEditConfig['tuning'];
  label: string;
  suffix?: string;
}) {
  const limits = {
    brightnessPercent: IMAGE_EDIT_LIMITS.brightnessPercent,
    contrastPercent: IMAGE_EDIT_LIMITS.contrastPercent,
    saturationPercent: IMAGE_EDIT_LIMITS.saturationPercent,
    temperaturePercent: IMAGE_EDIT_LIMITS.temperaturePercent,
    hueDegrees: IMAGE_EDIT_LIMITS.hueDegrees,
    sharpenPercent: IMAGE_EDIT_LIMITS.sharpenPercent,
  }[field];
  const disabled = editor.isEditing || editor.busy || !editor.canSelectFolder;
  return (
    <RangeField
      id={`image-edit-${field}`}
      label={label}
      value={editor.config.tuning[field]}
      suffix={suffix}
      min={limits.min}
      max={limits.max}
      step={limits.step}
      disabled={disabled}
      onChange={(value) => editor.updateTuning({ [field]: value })}
    />
  );
}

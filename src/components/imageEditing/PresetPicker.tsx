import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImageEditPresetSummary } from '../../../shared/imageEditing';
import { DEFAULT_IMAGE_EDIT_TUNING } from '../../../shared/imageEditing';
import type { BrandingImagePresetConfig } from '../../../shared/branding';
import { Badge, Button, controlBase, Icon, Panel } from '../ui/ui';

const inputBase = controlBase;

const FAVORITES_KEY = 'image-edit-favorite-presets';

export interface PresetPickerProps {
  value: BrandingImagePresetConfig;
  disabled?: boolean;
  onChange: (next: BrandingImagePresetConfig) => void;
}

export function PresetPicker({ value, disabled = false, onChange }: PresetPickerProps) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<ImageEditPresetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});
  const previewAttempted = useRef(new Set<string>());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem(FAVORITES_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });

  const refreshPresets = useCallback(async () => {
    setLoading(true);
    try {
      setPresets(await window.api.listImageEditPresets());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load presets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPresets();
  }, [refreshPresets]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    } catch {
      // ignore
    }
  }, [favoriteIds]);

  const loadPreview = useCallback(async (presetId: string) => {
    if (previewAttempted.current.has(presetId)) {
      return;
    }
    previewAttempted.current.add(presetId);
    setPreviewLoading((current) => ({ ...current, [presetId]: true }));
    try {
      const dataUrl = await window.api.previewImageEditPreset(presetId);
      setPreviewUrls((current) => ({ ...current, [presetId]: dataUrl }));
    } catch {
      // preview is best-effort
    } finally {
      setPreviewLoading((current) => ({ ...current, [presetId]: false }));
    }
  }, []);

  const groups = useMemo(
    () => Array.from(new Set(presets.map((preset) => preset.group))),
    [presets],
  );
  const favoritePresets = presets.filter((preset) => favoriteIds.includes(preset.id));
  const groupOptions = useMemo(
    () => (favoritePresets.length > 0 ? ['Favorites', ...groups] : groups),
    [favoritePresets.length, groups],
  );
  const selectedPresets = useMemo(
    () =>
      selectedGroup === 'Favorites'
        ? favoritePresets
        : presets.filter((preset) => preset.group === selectedGroup),
    [favoritePresets, presets, selectedGroup],
  );
  const visiblePresets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return selectedPresets;
    }
    return selectedPresets.filter(
      (preset) =>
        preset.name.toLowerCase().includes(normalized) ||
        preset.group.toLowerCase().includes(normalized),
    );
  }, [query, selectedPresets]);

  useEffect(() => {
    setSelectedGroup((current) =>
      groupOptions.includes(current) ? current : groupOptions[0] ?? '',
    );
  }, [groupOptions]);

  const applyPreset = (preset: ImageEditPresetSummary) => {
    onChange({
      enabled: true,
      presetId: preset.id,
      presetName: preset.name,
      filter: preset.filter,
      tuning: { ...DEFAULT_IMAGE_EDIT_TUNING, ...preset.tuning },
    });
  };

  const clearPreset = () => {
    onChange({
      enabled: false,
      presetId: null,
      presetName: null,
      filter: 'none',
      tuning: { ...DEFAULT_IMAGE_EDIT_TUNING },
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-surface-border bg-surface-raised px-3 py-2.5 text-left transition hover:border-accent/50 hover:bg-surface-hover"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <span className="block text-sm font-semibold text-slate-100">Image preset</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {value.enabled && value.presetName
              ? `Selected: ${value.presetName}`
              : 'Optional Lightroom-style look for video encode'}
          </span>
        </span>
        <Icon
          name="chevron-down"
          size={14}
          className={`text-slate-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <Panel className="space-y-2.5 bg-surface p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {value.enabled && value.presetName ? (
              <Badge tone="accent">{value.presetName}</Badge>
            ) : (
              <Badge tone="neutral">No preset</Badge>
            )}
            <Button size="sm" variant="secondary" disabled={disabled || !value.enabled} onClick={clearPreset}>
              Clear
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="folder"
              disabled={disabled || loading}
              onClick={() => {
                void (async () => {
                  try {
                    const folderPath = await window.api.selectImageEditPresetFolder();
                    if (!folderPath) {
                      return;
                    }
                    setPresets(await window.api.importImageEditPresets(folderPath));
                    setError(null);
                  } catch (importError) {
                    setError(
                      importError instanceof Error
                        ? importError.message
                        : 'Unable to import presets',
                    );
                  }
                })();
              }}
            >
              Import folder
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={query}
              disabled={disabled || loading}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search presets…"
              className={inputBase}
            />
            <select
              value={selectedGroup}
              disabled={disabled || loading || groupOptions.length === 0}
              onChange={(event) => setSelectedGroup(event.target.value)}
              className={inputBase}
            >
              {groupOptions.length === 0 ? <option value="">No categories</option> : null}
              {groupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="px-1 py-2 text-xs text-slate-500">Loading preset library…</p>
          ) : error ? (
            <p className="px-1 py-2 text-xs text-rose-300">{error}</p>
          ) : visiblePresets.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-500">No presets match.</p>
          ) : (
            <div className="grid max-h-56 gap-1.5 overflow-y-auto border-t border-surface-border pt-2 sm:grid-cols-2">
              {visiblePresets.map((preset) => (
                <PresetRow
                  key={preset.id}
                  preset={preset}
                  selected={value.presetId === preset.id}
                  favorite={favoriteIds.includes(preset.id)}
                  disabled={disabled}
                  previewUrl={previewUrls[preset.id]}
                  previewBusy={Boolean(previewLoading[preset.id])}
                  onLoadPreview={() => {
                    void loadPreview(preset.id);
                  }}
                  onSelect={() => applyPreset(preset)}
                  onToggleFavorite={() => {
                    setFavoriteIds((current) =>
                      current.includes(preset.id)
                        ? current.filter((id) => id !== preset.id)
                        : [...current, preset.id],
                    );
                  }}
                />
              ))}
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function PresetRow({
  preset,
  selected,
  favorite,
  disabled,
  previewUrl,
  previewBusy,
  onLoadPreview,
  onSelect,
  onToggleFavorite,
}: {
  preset: ImageEditPresetSummary;
  selected: boolean;
  favorite: boolean;
  disabled: boolean;
  previewUrl?: string;
  previewBusy: boolean;
  onLoadPreview: () => void;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  useEffect(() => {
    onLoadPreview();
  }, [onLoadPreview]);

  return (
    <div
      className={`flex min-h-14 items-center gap-1 rounded-md border bg-surface transition ${
        selected ? 'border-accent/60 bg-accent/10' : 'border-surface-border hover:border-accent/30'
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={`flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1 text-left text-[11px] transition ${
          selected ? 'text-sky-200' : 'text-slate-400 hover:text-slate-200'
        } disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <span className="h-11 w-11 shrink-0 overflow-hidden rounded border border-surface-border bg-surface-raised">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-[9px] text-slate-600">
              {previewBusy ? '…' : '—'}
            </span>
          )}
        </span>
        <span className="line-clamp-2">{preset.name}</span>
      </button>
      <button
        type="button"
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={onToggleFavorite}
        className={`mr-1 rounded p-1 transition hover:bg-surface-hover ${
          favorite ? 'text-amber-300' : 'text-slate-600 hover:text-slate-300'
        }`}
      >
        <Icon name="star" size={13} />
      </button>
    </div>
  );
}

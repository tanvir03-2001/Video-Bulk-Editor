import { useCallback, useEffect, useMemo, useState } from 'react';

export const EDITOR_SETTINGS_PANEL_RATIO_KEY = 'vfg-editor-settings-panel-ratio';
export const LEGACY_EDITOR_SETTINGS_PANEL_WIDTH_KEY = 'vfg-editor-settings-panel-width';

export const EDITOR_SETTINGS_PANEL_MIN_RATIO = 0.3;
export const EDITOR_SETTINGS_PANEL_MAX_RATIO = 0.7;
export const EDITOR_SETTINGS_PANEL_DEFAULT_RATIO = 0.4;

export function clampPanelRatio(ratio: number): number {
  return Math.min(
    EDITOR_SETTINGS_PANEL_MAX_RATIO,
    Math.max(EDITOR_SETTINGS_PANEL_MIN_RATIO, ratio),
  );
}

function loadStoredPanelRatio(): number {
  if (typeof window === 'undefined') {
    return EDITOR_SETTINGS_PANEL_DEFAULT_RATIO;
  }

  try {
    const raw = window.localStorage.getItem(EDITOR_SETTINGS_PANEL_RATIO_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) {
      return clampPanelRatio(parsed);
    }
  } catch {
    // ignore
  }

  return EDITOR_SETTINGS_PANEL_DEFAULT_RATIO;
}

function migrateLegacyPanelWidth(containerWidth: number): number | null {
  if (typeof window === 'undefined' || containerWidth <= 0) {
    return null;
  }

  try {
    if (window.localStorage.getItem(EDITOR_SETTINGS_PANEL_RATIO_KEY)) {
      return null;
    }

    const raw = window.localStorage.getItem(LEGACY_EDITOR_SETTINGS_PANEL_WIDTH_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) {
      return null;
    }

    const ratio = clampPanelRatio(parsed / containerWidth);
    window.localStorage.setItem(EDITOR_SETTINGS_PANEL_RATIO_KEY, String(ratio));
    window.localStorage.removeItem(LEGACY_EDITOR_SETTINGS_PANEL_WIDTH_KEY);
    return ratio;
  } catch {
    return null;
  }
}

function saveStoredPanelRatio(ratio: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(EDITOR_SETTINGS_PANEL_RATIO_KEY, String(clampPanelRatio(ratio)));
  } catch {
    // ignore
  }
}

export function useResizablePanelWidth(containerWidth: number) {
  const [ratio, setRatio] = useState(loadStoredPanelRatio);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (containerWidth <= 0) {
      return;
    }

    const migrated = migrateLegacyPanelWidth(containerWidth);
    if (migrated !== null) {
      setRatio(migrated);
      return;
    }

    setRatio((current) => clampPanelRatio(current));
  }, [containerWidth]);

  const settingsWidth = useMemo(() => {
    if (containerWidth <= 0) {
      return 0;
    }
    return Math.round(containerWidth * clampPanelRatio(ratio));
  }, [containerWidth, ratio]);

  const startDrag = useCallback(
    (containerLeft: number) => {
      if (containerWidth <= 0) {
        return;
      }

      setIsDragging(true);

      const onMove = (event: MouseEvent) => {
        const nextRatio = clampPanelRatio((event.clientX - containerLeft) / containerWidth);
        setRatio(nextRatio);
      };

      const onUp = () => {
        setIsDragging(false);
        setRatio((current) => {
          const next = clampPanelRatio(current);
          saveStoredPanelRatio(next);
          return next;
        });
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [containerWidth],
  );

  return {
    ratio,
    settingsWidth,
    isDragging,
    startDrag,
  };
}

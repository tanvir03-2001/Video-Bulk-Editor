import type { ComposerMode } from '../../shared/composer';

const COMPOSER_PREFS_KEY = 'vfg-composer-prefs';

export interface ComposerPrefs {
  composerMode: ComposerMode;
}

const DEFAULT_PREFS: ComposerPrefs = {
  composerMode: 'video-plus-audio',
};

function isComposerMode(value: unknown): value is ComposerMode {
  return value === 'video-plus-audio' || value === 'video-only';
}

export function loadComposerPrefs(): ComposerPrefs {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PREFS };
  }

  try {
    const raw = window.localStorage.getItem(COMPOSER_PREFS_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFS };
    }
    const parsed = JSON.parse(raw) as Partial<ComposerPrefs>;
    return {
      composerMode: isComposerMode(parsed.composerMode)
        ? parsed.composerMode
        : DEFAULT_PREFS.composerMode,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveComposerPrefs(prefs: ComposerPrefs): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      COMPOSER_PREFS_KEY,
      JSON.stringify({
        composerMode: isComposerMode(prefs.composerMode)
          ? prefs.composerMode
          : DEFAULT_PREFS.composerMode,
      } satisfies ComposerPrefs),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function saveComposerMode(mode: ComposerMode): void {
  const current = loadComposerPrefs();
  saveComposerPrefs({ ...current, composerMode: mode });
}

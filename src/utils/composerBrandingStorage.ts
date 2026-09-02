import type { BrandingConfig } from '../../shared/branding';
import { createDefaultComposerBranding } from '../../shared/composer';

const COMPOSER_BRANDING_STORAGE_KEY = 'vfg-composer-branding';

function mergeComposerBranding(raw: Partial<BrandingConfig> | null | undefined): BrandingConfig {
  const defaults = createDefaultComposerBranding();
  if (!raw) {
    return defaults;
  }

  return {
    watermark: {
      ...defaults.watermark,
      ...raw.watermark,
      text: {
        ...defaults.watermark.text,
        ...raw.watermark?.text,
      },
    },
    movingText: {
      ...defaults.movingText,
      ...raw.movingText,
    },
    canvas: {
      ...defaults.canvas,
      ...raw.canvas,
      top: { ...defaults.canvas.top, ...raw.canvas?.top },
      bottom: { ...defaults.canvas.bottom, ...raw.canvas?.bottom },
      left: { ...defaults.canvas.left, ...raw.canvas?.left },
      right: { ...defaults.canvas.right, ...raw.canvas?.right },
    },
    imagePreset: {
      ...defaults.imagePreset,
      ...raw.imagePreset,
      tuning: {
        ...defaults.imagePreset.tuning,
        ...raw.imagePreset?.tuning,
      },
    },
    subtitles: {
      ...defaults.subtitles,
      ...raw.subtitles,
    },
  };
}

export function loadStoredComposerBranding(): BrandingConfig {
  if (typeof window === 'undefined') {
    return createDefaultComposerBranding();
  }

  try {
    const raw = window.localStorage.getItem(COMPOSER_BRANDING_STORAGE_KEY);
    if (!raw) {
      return createDefaultComposerBranding();
    }
    return mergeComposerBranding(JSON.parse(raw) as Partial<BrandingConfig>);
  } catch {
    return createDefaultComposerBranding();
  }
}

export function saveStoredComposerBranding(branding: BrandingConfig): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(COMPOSER_BRANDING_STORAGE_KEY, JSON.stringify(branding));
  } catch {
    // ignore quota / privacy mode errors
  }
}

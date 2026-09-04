import type { BrandingConfig } from '../../shared/branding';
import { DEFAULT_BRANDING_CONFIG } from '../../shared/branding';
import type { ImageEditConfig } from '../../shared/imageEditing';
import { DEFAULT_IMAGE_EDIT_CONFIG } from '../../shared/imageEditing';

export function createFreshBrandingConfig(): BrandingConfig {
  return mergeBrandingConfig({}, DEFAULT_BRANDING_CONFIG);
}

export function createFreshImageEditConfig(): ImageEditConfig {
  return mergeImageEditConfig({}, DEFAULT_IMAGE_EDIT_CONFIG);
}

export function mergeBrandingConfig(
  raw: Partial<BrandingConfig> | null | undefined,
  defaults: BrandingConfig,
): BrandingConfig {
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

export function mergeImageEditConfig(
  raw: Partial<ImageEditConfig> | null | undefined,
  defaults: ImageEditConfig,
): ImageEditConfig {
  if (!raw) {
    return defaults;
  }

  return {
    ...defaults,
    ...raw,
    canvas: {
      ...defaults.canvas,
      ...raw.canvas,
      top: { ...defaults.canvas.top, ...raw.canvas?.top },
      bottom: { ...defaults.canvas.bottom, ...raw.canvas?.bottom },
      left: { ...defaults.canvas.left, ...raw.canvas?.left },
      right: { ...defaults.canvas.right, ...raw.canvas?.right },
    },
    tuning: {
      ...defaults.tuning,
      ...raw.tuning,
    },
    watermark: {
      ...defaults.watermark,
      ...raw.watermark,
      text: {
        ...defaults.watermark.text,
        ...raw.watermark?.text,
      },
    },
  };
}

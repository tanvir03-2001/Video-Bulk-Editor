import path from 'node:path';
import {
  DEFAULT_IMAGE_EDIT_CONFIG,
  EDITED_IMAGES_DIR,
  IMAGE_EDIT_CROP_MODES,
  IMAGE_EDIT_FILTERS,
  IMAGE_EDIT_LIMITS,
  IMAGE_EDIT_REPORT_FILE,
  SUPPORTED_IMAGE_EDIT_EXTENSIONS,
  type ImageEditConfig,
  type ImageEditCropMode,
  type ImageEditFilter,
  type ImageEditWatermarkConfig,
} from '../../../shared/imageEditing';
import {
  BRANDING_ASPECT_RATIOS,
  BRANDING_FONT_FAMILIES,
  BRANDING_FONT_WEIGHTS,
  BRANDING_LIMITS,
  OVERLAY_POSITIONS,
  type BrandingAspectRatio,
  type BrandingCanvasConfig,
  type BrandingFontFamily,
  type BrandingFontWeight,
  type OverlayPosition,
  type SideImageConfig,
  type TextLogoConfig,
} from '../../../shared/branding';

const MAX_TEXT_PATH_LENGTH = 4096;
const MAX_TEXT_LENGTH = 120;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function sanitizePath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().slice(0, MAX_TEXT_PATH_LENGTH);
  return normalized.length > 0 && path.isAbsolute(normalized) ? normalized : null;
}

function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function sanitizeOptionalString(value: unknown, fallback: string | null): string | null {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().slice(0, MAX_TEXT_PATH_LENGTH);
  return normalized.length > 0 ? normalized : null;
}

function sanitizeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim().slice(0, MAX_TEXT_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeOptionalText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function sanitizeTextLogo(raw: unknown, defaults: TextLogoConfig): TextLogoConfig {
  const source = (raw ?? {}) as Partial<TextLogoConfig>;
  return {
    text: sanitizeText(source.text, defaults.text),
    secondaryText: sanitizeOptionalText(source.secondaryText, defaults.secondaryText),
    fontFamily: sanitizeEnum<BrandingFontFamily>(
      source.fontFamily,
      BRANDING_FONT_FAMILIES,
      defaults.fontFamily,
    ),
    fontSizePercent: clampNumber(
      source.fontSizePercent,
      BRANDING_LIMITS.textFontSizePercent.min,
      BRANDING_LIMITS.textFontSizePercent.max,
      defaults.fontSizePercent,
    ),
    secondaryFontSizePercent: clampNumber(
      source.secondaryFontSizePercent,
      BRANDING_LIMITS.secondaryTextFontSizePercent.min,
      BRANDING_LIMITS.secondaryTextFontSizePercent.max,
      defaults.secondaryFontSizePercent,
    ),
    fontWeight: sanitizeEnum<BrandingFontWeight>(
      source.fontWeight,
      BRANDING_FONT_WEIGHTS,
      defaults.fontWeight,
    ),
    color: sanitizeHexColor(source.color, defaults.color),
    shadow: typeof source.shadow === 'boolean' ? source.shadow : defaults.shadow,
  };
}

function sanitizeSideImage(raw: unknown, fallback: SideImageConfig): SideImageConfig {
  const source = (raw ?? {}) as Partial<SideImageConfig>;
  return {
    enabled: source.enabled === true,
    imagePath: sanitizePath(source.imagePath) ?? fallback.imagePath,
  };
}

function sanitizeCanvas(raw: unknown): BrandingCanvasConfig {
  const source = (raw ?? {}) as Partial<BrandingCanvasConfig>;
  const defaults = DEFAULT_IMAGE_EDIT_CONFIG.canvas;
  return {
    aspectRatio: sanitizeEnum<BrandingAspectRatio>(
      source.aspectRatio,
      BRANDING_ASPECT_RATIOS,
      defaults.aspectRatio,
    ),
    customWidth: clampNumber(
      source.customWidth,
      IMAGE_EDIT_LIMITS.customRatio.min,
      IMAGE_EDIT_LIMITS.customRatio.max,
      defaults.customWidth,
    ),
    customHeight: clampNumber(
      source.customHeight,
      IMAGE_EDIT_LIMITS.customRatio.min,
      IMAGE_EDIT_LIMITS.customRatio.max,
      defaults.customHeight,
    ),
    zoomPercent: clampNumber(
      source.zoomPercent,
      IMAGE_EDIT_LIMITS.zoomPercent.min,
      IMAGE_EDIT_LIMITS.zoomPercent.max,
      defaults.zoomPercent,
    ),
    top: sanitizeSideImage(source.top, defaults.top),
    bottom: sanitizeSideImage(source.bottom, defaults.bottom),
    left: sanitizeSideImage(source.left, defaults.left),
    right: sanitizeSideImage(source.right, defaults.right),
  };
}

function sanitizeWatermark(raw: unknown): ImageEditWatermarkConfig {
  const source = (raw ?? {}) as Partial<ImageEditWatermarkConfig>;
  const defaults = DEFAULT_IMAGE_EDIT_CONFIG.watermark;
  return {
    enabled: source.enabled === true,
    mode: source.mode === 'text' ? 'text' : 'image',
    imagePath: sanitizePath(source.imagePath) ?? defaults.imagePath,
    text: sanitizeTextLogo(source.text, defaults.text),
    position: sanitizeEnum<OverlayPosition>(
      source.position,
      OVERLAY_POSITIONS,
      defaults.position,
    ),
    scalePercent: clampNumber(
      source.scalePercent,
      IMAGE_EDIT_LIMITS.watermarkScalePercent.min,
      IMAGE_EDIT_LIMITS.watermarkScalePercent.max,
      defaults.scalePercent,
    ),
    opacityPercent: clampNumber(
      source.opacityPercent,
      IMAGE_EDIT_LIMITS.watermarkOpacityPercent.min,
      IMAGE_EDIT_LIMITS.watermarkOpacityPercent.max,
      defaults.opacityPercent,
    ),
    marginPercent: clampNumber(
      source.marginPercent,
      IMAGE_EDIT_LIMITS.watermarkMarginPercent.min,
      IMAGE_EDIT_LIMITS.watermarkMarginPercent.max,
      defaults.marginPercent,
    ),
  };
}

export function sanitizeImageEditConfig(raw: unknown): ImageEditConfig {
  const source = (raw ?? {}) as Partial<ImageEditConfig>;
  const defaults = DEFAULT_IMAGE_EDIT_CONFIG;
  const tuning = (source.tuning ?? {}) as Partial<ImageEditConfig['tuning']>;

  return {
    canvas: sanitizeCanvas(source.canvas),
    cropMode: sanitizeEnum<ImageEditCropMode>(
      source.cropMode,
      IMAGE_EDIT_CROP_MODES,
      defaults.cropMode,
    ),
    backgroundColor: sanitizeHexColor(source.backgroundColor, defaults.backgroundColor),
    presetId: sanitizeOptionalString(source.presetId, defaults.presetId),
    presetName: sanitizeOptionalString(source.presetName, defaults.presetName),
    filter: sanitizeEnum<ImageEditFilter>(source.filter, IMAGE_EDIT_FILTERS, defaults.filter),
    tuning: {
      brightnessPercent: clampNumber(
        tuning.brightnessPercent,
        IMAGE_EDIT_LIMITS.brightnessPercent.min,
        IMAGE_EDIT_LIMITS.brightnessPercent.max,
        defaults.tuning.brightnessPercent,
      ),
      contrastPercent: clampNumber(
        tuning.contrastPercent,
        IMAGE_EDIT_LIMITS.contrastPercent.min,
        IMAGE_EDIT_LIMITS.contrastPercent.max,
        defaults.tuning.contrastPercent,
      ),
      saturationPercent: clampNumber(
        tuning.saturationPercent,
        IMAGE_EDIT_LIMITS.saturationPercent.min,
        IMAGE_EDIT_LIMITS.saturationPercent.max,
        defaults.tuning.saturationPercent,
      ),
      temperaturePercent: clampNumber(
        tuning.temperaturePercent,
        IMAGE_EDIT_LIMITS.temperaturePercent.min,
        IMAGE_EDIT_LIMITS.temperaturePercent.max,
        defaults.tuning.temperaturePercent,
      ),
      hueDegrees: clampNumber(
        tuning.hueDegrees,
        IMAGE_EDIT_LIMITS.hueDegrees.min,
        IMAGE_EDIT_LIMITS.hueDegrees.max,
        defaults.tuning.hueDegrees,
      ),
      sharpenPercent: clampNumber(
        tuning.sharpenPercent,
        IMAGE_EDIT_LIMITS.sharpenPercent.min,
        IMAGE_EDIT_LIMITS.sharpenPercent.max,
        defaults.tuning.sharpenPercent,
      ),
    },
    watermark: sanitizeWatermark(source.watermark),
    outputFormat: sanitizeEnum(source.outputFormat, ['jpg', 'png', 'webp'] as const, defaults.outputFormat),
    qualityPercent: clampNumber(
      source.qualityPercent,
      IMAGE_EDIT_LIMITS.qualityPercent.min,
      IMAGE_EDIT_LIMITS.qualityPercent.max,
      defaults.qualityPercent,
    ),
  };
}

export function isSupportedImageEditExtension(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase().replace('.', '');
  return SUPPORTED_IMAGE_EDIT_EXTENSIONS.includes(extension);
}

export function hasAnyImageEditEnabled(config: ImageEditConfig): boolean {
  const sides = [config.canvas.top, config.canvas.bottom, config.canvas.left, config.canvas.right];
  return (
    config.presetId !== null ||
    config.filter !== 'none' ||
    Object.values(config.tuning).some((value) => value !== 0) ||
    config.watermark.enabled ||
    sides.some((side) => side.enabled) ||
    config.canvas.aspectRatio !== 'source' ||
    config.canvas.zoomPercent !== 100 ||
    config.cropMode !== 'cover' ||
    config.outputFormat !== DEFAULT_IMAGE_EDIT_CONFIG.outputFormat ||
    config.qualityPercent !== DEFAULT_IMAGE_EDIT_CONFIG.qualityPercent
  );
}

export function validateImageEditConfig(config: ImageEditConfig): string | null {
  if (!hasAnyImageEditEnabled(config)) {
    return 'Choose a filter, tuning adjustment, crop/canvas change, side image, or watermark before rendering.';
  }

  if (config.watermark.enabled) {
    if (config.watermark.mode === 'image') {
      if (!config.watermark.imagePath) {
        return 'Select a watermark logo before rendering.';
      }
      if (!isSupportedImageEditExtension(config.watermark.imagePath)) {
        return `Unsupported watermark format. Use ${SUPPORTED_IMAGE_EDIT_EXTENSIONS.join(', ')}.`;
      }
    } else if (!config.watermark.text.text.trim()) {
      return 'Enter primary text for the Text Logo watermark.';
    }
  }

  const sides = [
    ['Top', config.canvas.top],
    ['Bottom', config.canvas.bottom],
    ['Left', config.canvas.left],
    ['Right', config.canvas.right],
  ] as const;
  for (const [label, side] of sides) {
    if (!side.enabled) {
      continue;
    }
    if (!side.imagePath) {
      return `Select an image for the ${label.toLowerCase()} side.`;
    }
    if (!isSupportedImageEditExtension(side.imagePath)) {
      return `Unsupported ${label.toLowerCase()} side image format. Use ${SUPPORTED_IMAGE_EDIT_EXTENSIONS.join(', ')}.`;
    }
  }

  return null;
}

export function resolveDefaultImageEditOutputFolder(folderPath: string): string {
  return path.join(folderPath, EDITED_IMAGES_DIR);
}

export function isInsideSourceFolder(outputFolder: string, sourceFolder: string): boolean {
  const output = path.resolve(outputFolder);
  const source = path.resolve(sourceFolder);
  return output === source || output.startsWith(`${source}${path.sep}`);
}

export function resolveImageEditReportPath(outputFolder: string): string {
  return path.join(outputFolder, IMAGE_EDIT_REPORT_FILE);
}

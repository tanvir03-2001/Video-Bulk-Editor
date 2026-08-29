import path from 'node:path';
import {
  BRANDED_VIDEOS_DIR,
  BRANDING_ASPECT_RATIOS,
  BRANDING_FONT_FAMILIES,
  BRANDING_FONT_WEIGHTS,
  BRANDING_LIMITS,
  DEFAULT_BRANDING_CONFIG,
  MOVING_TEXT_SPEEDS,
  OVERLAY_POSITIONS,
  SUPPORTED_LOGO_EXTENSIONS,
  type BrandingConfig,
  type BrandingAspectRatio,
  type BrandingFontFamily,
  type BrandingFontWeight,
  type MovingTextSpeed,
  type OverlayPosition,
  type SideImageConfig,
  type TextLogoConfig,
} from '../../../shared/branding';

/** Length of the branded preview clip. Short enough to render fast, long enough to show drift. */
export const PREVIEW_DURATION_SECONDS = 5;

/** Preview starts a little into the video so intros/black frames are skipped. */
export const PREVIEW_START_FRACTION = 0.15;
export const PREVIEW_MAX_START_SECONDS = 20;

export const MAX_TEXT_LENGTH = 120;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
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

function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function sanitizeEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function sanitizeTextLogo(raw: unknown): TextLogoConfig {
  const source = (raw ?? {}) as Partial<TextLogoConfig>;
  const defaults = DEFAULT_BRANDING_CONFIG.watermark.text;

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
    fontWeight: sanitizeEnum<BrandingFontWeight>(
      source.fontWeight,
      BRANDING_FONT_WEIGHTS,
      defaults.fontWeight,
    ),
    color: sanitizeHexColor(source.color, defaults.color),
    shadow: typeof source.shadow === 'boolean' ? source.shadow : defaults.shadow,
  };
}

function sanitizeSideImage(raw: unknown): SideImageConfig {
  const source = (raw ?? {}) as Partial<SideImageConfig>;
  const imagePath =
    typeof source.imagePath === 'string' && source.imagePath.trim().length > 0
      ? source.imagePath.trim()
      : null;

  return {
    enabled: source.enabled === true,
    imagePath: imagePath && path.isAbsolute(imagePath) ? imagePath : null,
  };
}

function sanitizeCanvasConfig(raw: unknown): BrandingConfig['canvas'] {
  const source = (raw ?? {}) as Partial<BrandingConfig['canvas']>;
  const defaults = DEFAULT_BRANDING_CONFIG.canvas;

  return {
    aspectRatio: sanitizeEnum<BrandingAspectRatio>(
      source.aspectRatio,
      BRANDING_ASPECT_RATIOS,
      defaults.aspectRatio,
    ),
    customWidth: clampNumber(
      source.customWidth,
      BRANDING_LIMITS.customRatio.min,
      BRANDING_LIMITS.customRatio.max,
      defaults.customWidth,
    ),
    customHeight: clampNumber(
      source.customHeight,
      BRANDING_LIMITS.customRatio.min,
      BRANDING_LIMITS.customRatio.max,
      defaults.customHeight,
    ),
    zoomPercent: clampNumber(
      source.zoomPercent,
      BRANDING_LIMITS.zoomPercent.min,
      BRANDING_LIMITS.zoomPercent.max,
      defaults.zoomPercent,
    ),
    top: sanitizeSideImage(source.top),
    bottom: sanitizeSideImage(source.bottom),
    left: sanitizeSideImage(source.left),
    right: sanitizeSideImage(source.right),
  };
}

/**
 * Normalize an untrusted branding config coming over IPC into a safe, clamped config.
 */
export function sanitizeBrandingConfig(raw: unknown): BrandingConfig {
  const source = (raw ?? {}) as Partial<BrandingConfig>;
  const watermarkSource = (source.watermark ?? {}) as Partial<BrandingConfig['watermark']>;
  const movingTextSource = (source.movingText ?? {}) as Partial<BrandingConfig['movingText']>;
  const watermarkDefaults = DEFAULT_BRANDING_CONFIG.watermark;
  const movingTextDefaults = DEFAULT_BRANDING_CONFIG.movingText;

  const imagePath =
    typeof watermarkSource.imagePath === 'string' && watermarkSource.imagePath.trim().length > 0
      ? watermarkSource.imagePath
      : null;

  return {
    watermark: {
      enabled: watermarkSource.enabled === true,
      mode: watermarkSource.mode === 'text' ? 'text' : 'image',
      imagePath: imagePath && path.isAbsolute(imagePath) ? imagePath : null,
      text: sanitizeTextLogo(watermarkSource.text),
      position: sanitizeEnum<OverlayPosition>(
        watermarkSource.position,
        OVERLAY_POSITIONS,
        watermarkDefaults.position,
      ),
      scalePercent: clampNumber(
        watermarkSource.scalePercent,
        BRANDING_LIMITS.watermarkScalePercent.min,
        BRANDING_LIMITS.watermarkScalePercent.max,
        watermarkDefaults.scalePercent,
      ),
      opacityPercent: clampNumber(
        watermarkSource.opacityPercent,
        BRANDING_LIMITS.watermarkOpacityPercent.min,
        BRANDING_LIMITS.watermarkOpacityPercent.max,
        watermarkDefaults.opacityPercent,
      ),
      marginPercent: clampNumber(
        watermarkSource.marginPercent,
        BRANDING_LIMITS.watermarkMarginPercent.min,
        BRANDING_LIMITS.watermarkMarginPercent.max,
        watermarkDefaults.marginPercent,
      ),
    },
    movingText: {
      enabled: movingTextSource.enabled === true,
      text: sanitizeText(movingTextSource.text, movingTextDefaults.text),
      opacityPercent: clampNumber(
        movingTextSource.opacityPercent,
        BRANDING_LIMITS.movingTextOpacityPercent.min,
        BRANDING_LIMITS.movingTextOpacityPercent.max,
        movingTextDefaults.opacityPercent,
      ),
      sizePercent: clampNumber(
        movingTextSource.sizePercent,
        BRANDING_LIMITS.movingTextSizePercent.min,
        BRANDING_LIMITS.movingTextSizePercent.max,
        movingTextDefaults.sizePercent,
      ),
      speed: sanitizeEnum<MovingTextSpeed>(
        movingTextSource.speed,
        MOVING_TEXT_SPEEDS,
        movingTextDefaults.speed,
      ),
    },
    canvas: sanitizeCanvasConfig(source.canvas),
  };
}

export function hasAnyBrandingEnabled(config: BrandingConfig): boolean {
  const canvas = config.canvas;
  const hasSideImage = [canvas.top, canvas.bottom, canvas.left, canvas.right].some(
    (side) => side.enabled,
  );
  const hasCanvasTransform = canvas.aspectRatio !== 'source' || canvas.zoomPercent !== 100;
  return config.watermark.enabled || config.movingText.enabled || hasSideImage || hasCanvasTransform;
}

export function isSupportedLogoExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return SUPPORTED_LOGO_EXTENSIONS.includes(ext);
}

/**
 * Returns a human-readable reason when the config cannot be rendered, otherwise null.
 */
export function validateBrandingConfig(config: BrandingConfig): string | null {
  if (!hasAnyBrandingEnabled(config)) {
    return 'Enable Watermark, Moving Text, a side image, a canvas format, or zoom before rendering.';
  }

  if (config.watermark.enabled && config.watermark.mode === 'image') {
    if (!config.watermark.imagePath) {
      return 'Select a logo image file for the Image Logo watermark.';
    }
    if (!isSupportedLogoExtension(config.watermark.imagePath)) {
      return `Unsupported logo format. Use ${SUPPORTED_LOGO_EXTENSIONS.join(', ')}.`;
    }
  }

  if (config.canvas.aspectRatio === 'custom') {
    if (config.canvas.customWidth < BRANDING_LIMITS.customRatio.min || config.canvas.customHeight < BRANDING_LIMITS.customRatio.min) {
      return 'Custom aspect ratio width and height must be greater than zero.';
    }
  }

  const sideImages = [
    ['Top', config.canvas.top],
    ['Bottom', config.canvas.bottom],
    ['Left', config.canvas.left],
    ['Right', config.canvas.right],
  ] as const;
  for (const [label, side] of sideImages) {
    if (!side.enabled) {
      continue;
    }
    if (!side.imagePath) {
      return `Select an image for the ${label} side.`;
    }
    if (!isSupportedLogoExtension(side.imagePath)) {
      return `Unsupported ${label.toLowerCase()} side image format. Use ${SUPPORTED_LOGO_EXTENSIONS.join(', ')}.`;
    }
  }

  return null;
}

export function resolveDefaultOutputFolder(folderPath: string): string {
  return path.join(folderPath, BRANDED_VIDEOS_DIR);
}

/** Guards against writing branded output on top of the source files. */
export function isSameOrInsideSourceFile(outputFolder: string, videoPath: string): boolean {
  return path.resolve(path.dirname(videoPath)) === path.resolve(outputFolder);
}

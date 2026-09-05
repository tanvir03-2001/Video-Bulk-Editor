import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Sharp } from 'sharp';
import type { BrandingSide } from '../../../shared/branding';
import { ProcessingCancelledError } from '../frameGenerator';
import {
  IMAGE_EDIT_FILTERS,
  type ImageEditConfig,
  type ImageEditFilter,
} from '../../../shared/imageEditing';
import {
  isSupportedImageEditExtension,
  validateImageEditConfig,
} from './imageEditingConfig';
import {
  resolveCanvasLayout,
  type CanvasLayout,
  type ImageDimensions,
} from '../branding/canvasLayout';
import { renderTextOverlayAsset } from '../branding/overlayAssets';

export interface ImageEditResult {
  outputPath: string;
  outputWidth: number;
  outputHeight: number;
}

interface CompositeResult {
  image: Sharp;
  layout: CanvasLayout;
}

interface FilterAdjustment {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  grayscale: boolean;
  sepia: boolean;
}

function even(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2);
}

async function readImageDimensions(imagePath: string): Promise<ImageDimensions> {
  const metadata = await sharp(imagePath).metadata();
  const width = Number(metadata.width);
  const height = Number(metadata.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    throw new Error(`Unable to read image dimensions: ${path.basename(imagePath)}`);
  }

  const orientation = metadata.orientation ?? 1;
  const rotated = orientation >= 5 && orientation <= 8;
  return {
    width: rotated ? height : width,
    height: rotated ? width : height,
  };
}

function getFilterAdjustment(filter: ImageEditFilter): FilterAdjustment {
  switch (filter) {
    case 'vivid':
      return { brightness: 1.03, contrast: 1.1, saturation: 1.35, temperature: 0, grayscale: false, sepia: false };
    case 'warm':
      return { brightness: 1.02, contrast: 1.02, saturation: 1.08, temperature: 28, grayscale: false, sepia: false };
    case 'cool':
      return { brightness: 1, contrast: 1.03, saturation: 1.06, temperature: -28, grayscale: false, sepia: false };
    case 'mono':
      return { brightness: 1, contrast: 1.08, saturation: 1, temperature: 0, grayscale: true, sepia: false };
    case 'sepia':
      return { brightness: 1.02, contrast: 1.02, saturation: 0.86, temperature: 12, grayscale: false, sepia: true };
    case 'cinematic':
      return { brightness: 0.98, contrast: 1.14, saturation: 0.9, temperature: -6, grayscale: false, sepia: false };
    case 'high-contrast':
      return { brightness: 1, contrast: 1.28, saturation: 1.08, temperature: 0, grayscale: false, sepia: false };
    case 'none':
    default:
      return { brightness: 1, contrast: 1, saturation: 1, temperature: 0, grayscale: false, sepia: false };
  }
}

function applyImageAdjustments(image: Sharp, config: ImageEditConfig, filter: FilterAdjustment): Sharp {
  const tuning = config.tuning;
  const brightness =
    filter.brightness * Math.max(0.1, 1 + tuning.brightnessPercent / 100);
  const saturation =
    filter.saturation * Math.max(0, 1 + tuning.saturationPercent / 100);
  const contrast = filter.contrast * Math.max(0.1, 1 + tuning.contrastPercent / 100);
  const temperature = Math.max(-100, Math.min(100, filter.temperature + tuning.temperaturePercent));

  let adjusted = image.modulate({
    brightness,
    saturation,
    hue: tuning.hueDegrees,
  });

  if (contrast !== 1) {
    adjusted = adjusted.linear(contrast, 128 * (1 - contrast));
  }

  if (temperature !== 0) {
    const amount = Math.abs(temperature) / 100;
    const warm = temperature > 0;
    const red = warm ? 1 + amount * 0.35 : 1 - amount * 0.2;
    const blue = warm ? 1 - amount * 0.2 : 1 + amount * 0.35;
    adjusted = adjusted.recomb([
      [red, 0, 0],
      [0, 1, 0],
      [0, 0, blue],
    ]);
  }

  if (filter.grayscale) {
    adjusted = adjusted.grayscale();
  } else if (filter.sepia) {
    adjusted = adjusted.tint('#704214');
  }

  if (tuning.sharpenPercent > 0) {
    const sigma = 0.5 + (tuning.sharpenPercent / 100) * 2;
    adjusted = adjusted.sharpen({ sigma });
  }

  return adjusted;
}

async function createSourceLayer(
  imagePath: string,
  config: ImageEditConfig,
  layout: CanvasLayout,
): Promise<Buffer> {
  const zoom = config.canvas.zoomPercent / 100;
  const scaledWidth = even(layout.videoWidth * zoom);
  const scaledHeight = even(layout.videoHeight * zoom);
  const fit = config.cropMode === 'cover' ? 'cover' : 'contain';
  const filter = getFilterAdjustment(config.filter);

  let source = sharp(imagePath)
    .rotate()
    .resize(scaledWidth, scaledHeight, {
      fit,
      position: 'centre',
      background: config.backgroundColor,
    });
  source = applyImageAdjustments(source, config, filter);

  if (zoom > 1) {
    source = source.extract({
      left: Math.max(0, Math.floor((scaledWidth - layout.videoWidth) / 2)),
      top: Math.max(0, Math.floor((scaledHeight - layout.videoHeight) / 2)),
      width: layout.videoWidth,
      height: layout.videoHeight,
    });
  } else if (zoom < 1) {
    const horizontal = layout.videoWidth - scaledWidth;
    const vertical = layout.videoHeight - scaledHeight;
    source = source.extend({
      left: Math.floor(horizontal / 2),
      right: Math.ceil(horizontal / 2),
      top: Math.floor(vertical / 2),
      bottom: Math.ceil(vertical / 2),
      background: config.backgroundColor,
    });
  }

  return source.png().toBuffer();
}

async function createSideLayer(
  imagePath: string,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(imagePath)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
}

async function applyOpacity(
  imagePath: string,
  opacityPercent: number,
  width: number,
  options?: { withoutEnlargement?: boolean },
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const resized = sharp(imagePath)
    .rotate()
    .resize({
      width,
      fit: 'inside',
      withoutEnlargement: options?.withoutEnlargement === true,
    })
    .ensureAlpha();
  const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
  const opacity = opacityPercent / 100;
  for (let index = 3; index < data.length; index += info.channels) {
    data[index] = Math.round(data[index] * opacity);
  }
  return {
    buffer: await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    })
      .png()
      .toBuffer(),
    width: info.width,
    height: info.height,
  };
}

function overlayPosition(
  position: ImageEditConfig['watermark']['position'],
  canvasWidth: number,
  canvasHeight: number,
  overlayWidth: number,
  overlayHeight: number,
  margin: number,
): { left: number; top: number } {
  const horizontal =
    position.endsWith('left') ? margin : position.endsWith('right') ? canvasWidth - overlayWidth - margin : Math.round((canvasWidth - overlayWidth) / 2);
  const vertical =
    position.startsWith('top') ? margin : position.startsWith('bottom') ? canvasHeight - overlayHeight - margin : Math.round((canvasHeight - overlayHeight) / 2);
  return {
    left: Math.max(0, horizontal),
    top: Math.max(0, vertical),
  };
}

async function buildComposite(
  imagePath: string,
  config: ImageEditConfig,
  shouldCancel?: () => boolean,
  allowSvg = false,
): Promise<CompositeResult> {
  if (shouldCancel?.()) {
    throw new ProcessingCancelledError();
  }
  if (!isSupportedImageEditExtension(imagePath) && !(allowSvg && path.extname(imagePath).toLowerCase() === '.svg')) {
    throw new Error(`Unsupported image format: ${path.basename(imagePath)}`);
  }

  const sourceDimensions = await readImageDimensions(imagePath);
  const sideDimensions: Partial<Record<BrandingSide, ImageDimensions>> = {};
  const sideConfigs = [
    ['top', config.canvas.top],
    ['bottom', config.canvas.bottom],
    ['left', config.canvas.left],
    ['right', config.canvas.right],
  ] as const;

  for (const [side, sideConfig] of sideConfigs) {
    if (!sideConfig.enabled) {
      continue;
    }
    if (!sideConfig.imagePath) {
      throw new Error(`No image selected for the ${side} side`);
    }
    await fs.access(sideConfig.imagePath);
    sideDimensions[side] = await readImageDimensions(sideConfig.imagePath);
  }

  const layout = resolveCanvasLayout(sourceDimensions, config.canvas, sideDimensions);
  let composite = sharp({
    create: {
      width: layout.outputWidth,
      height: layout.outputHeight,
      channels: 4,
      background: config.backgroundColor,
    },
  });
  const layers: Array<{ input: Buffer; left: number; top: number }> = [
    {
      input: await createSourceLayer(imagePath, config, layout),
      left: layout.videoX,
      top: layout.videoY,
    },
  ];

  for (const slot of layout.slots) {
    if (shouldCancel?.()) {
      throw new ProcessingCancelledError();
    }
    const sideConfig = config.canvas[slot.side];
    if (sideConfig.imagePath) {
      layers.push({
        input: await createSideLayer(sideConfig.imagePath, slot.width, slot.height),
        left: slot.x,
        top: slot.y,
      });
    }
  }

  if (config.watermark.enabled) {
    let watermarkPath: string;
    const isTextLogo = config.watermark.mode === 'text';
    if (isTextLogo) {
      watermarkPath = await renderTextOverlayAsset({
        text: config.watermark.text.text,
        secondaryText: config.watermark.text.secondaryText,
        fontFamily: config.watermark.text.fontFamily,
        fontWeight: config.watermark.text.fontWeight,
        color: config.watermark.text.color,
        fontSizePx: Math.max(
          8,
          Math.round((layout.outputHeight * config.watermark.text.fontSizePercent) / 100),
        ),
        secondaryFontSizePx: Math.max(
          4,
          Math.round((layout.outputHeight * config.watermark.text.secondaryFontSizePercent) / 100),
        ),
        maxWidthPx: Math.round(layout.outputWidth * 0.9),
        shadow: config.watermark.text.shadow,
      });
    } else {
      if (!config.watermark.imagePath) {
        throw new Error('No watermark logo selected');
      }
      await fs.access(config.watermark.imagePath);
      watermarkPath = config.watermark.imagePath;
    }

    const watermark = await applyOpacity(
      watermarkPath,
      config.watermark.opacityPercent,
      Math.max(2, Math.round((layout.outputWidth * config.watermark.scalePercent) / 100)),
      { withoutEnlargement: isTextLogo },
    );
    const position = overlayPosition(
      config.watermark.position,
      layout.outputWidth,
      layout.outputHeight,
      watermark.width,
      watermark.height,
      Math.round((layout.outputWidth * config.watermark.marginPercent) / 100),
    );
    layers.push({ input: watermark.buffer, left: position.left, top: position.top });
  }

  // Sharp 0.35 only keeps the last .composite() call — put every layer in one pass.
  composite = composite.composite(layers);

  return { image: composite, layout };
}

async function encodeImage(image: Sharp, outputPath: string, config: ImageEditConfig): Promise<void> {
  const quality = config.qualityPercent;
  switch (config.outputFormat) {
    case 'png':
      await image.png({ compressionLevel: 9 }).toFile(outputPath);
      return;
    case 'webp':
      await image.webp({ quality }).toFile(outputPath);
      return;
    case 'jpg':
    default:
      await image.flatten({ background: config.backgroundColor }).jpeg({ quality }).toFile(outputPath);
  }
}

export async function editImage(
  imagePath: string,
  outputPath: string,
  config: ImageEditConfig,
  shouldCancel?: () => boolean,
): Promise<ImageEditResult> {
  const validationError = validateImageEditConfig(config);
  if (validationError) {
    throw new Error(validationError);
  }
  const result = await buildComposite(imagePath, config, shouldCancel);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await encodeImage(result.image, outputPath, config);
  return {
    outputPath,
    outputWidth: result.layout.outputWidth,
    outputHeight: result.layout.outputHeight,
  };
}

export async function renderImagePreview(
  imagePath: string,
  outputPath: string,
  config: ImageEditConfig,
  allowSvg = false,
): Promise<ImageEditResult> {
  const validationError = validateImageEditConfig(config);
  if (validationError) {
    throw new Error(validationError);
  }
  const result = await buildComposite(imagePath, config, undefined, allowSvg);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await result.image.png().toFile(outputPath);
  return {
    outputPath,
    outputWidth: result.layout.outputWidth,
    outputHeight: result.layout.outputHeight,
  };
}

export async function resolveEditedImagePath(
  outputFolder: string,
  imageName: string,
  outputFormat: ImageEditConfig['outputFormat'],
): Promise<string> {
  const baseName = path.parse(imageName).name;
  const extension = outputFormat === 'jpg' ? 'jpg' : outputFormat;
  let candidate = path.join(outputFolder, `${baseName}.${extension}`);
  let suffix = 1;

  for (;;) {
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
    suffix += 1;
    candidate = path.join(
      outputFolder,
      `${baseName}_${String(suffix).padStart(2, '0')}.${extension}`,
    );
  }
}

export function isImageEditFilter(value: string): value is ImageEditFilter {
  return (IMAGE_EDIT_FILTERS as readonly string[]).includes(value);
}

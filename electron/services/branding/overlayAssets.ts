import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  BRANDING_FONT_WEIGHT_VALUES,
  type BrandingFontFamily,
  type BrandingFontWeight,
} from '../../../shared/branding';
import { getFfmpegPath } from '../ffmpegPaths';
import { runFfmpegProcess } from './ffmpegProcess';

export interface TextAssetOptions {
  text: string;
  secondaryText?: string;
  fontFamily: BrandingFontFamily;
  fontWeight: BrandingFontWeight;
  color: string;
  /** Rendered cap height in pixels (already derived from the video height). */
  fontSizePx: number;
  /** Smaller supporting line, rendered at roughly 38% of the primary size. */
  secondaryFontSizePx?: number;
  /** Hard cap so long text never exceeds the frame. */
  maxWidthPx: number;
  shadow: boolean;
}

type TextRenderer = 'sharp-text' | 'sharp-svg' | 'ffmpeg-drawtext';

/**
 * Font size (em) needed for glyphs to end up roughly `fontSizePx` tall,
 * since typical cap-plus-lowercase height is about 75% of the em box.
 */
const EM_TO_GLYPH_HEIGHT = 1.3;

let cacheDirPromise: Promise<string> | null = null;
const assetCache = new Map<string, string>();
let renderedWith: TextRenderer | null = null;

function getCacheDir(): Promise<string> {
  if (!cacheDirPromise) {
    cacheDirPromise = fs.mkdtemp(path.join(os.tmpdir(), 'vfg-branding-'));
  }
  return cacheDirPromise;
}

/** Which text rasterizer succeeded last, for logging. */
export function getTextRendererName(): TextRenderer | null {
  return renderedWith;
}

export async function disposeOverlayAssets(): Promise<void> {
  if (!cacheDirPromise) {
    return;
  }
  const dir = await cacheDirPromise.catch(() => null);
  cacheDirPromise = null;
  assetCache.clear();
  if (!dir) {
    return;
  }
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

function hashOptions(options: TextAssetOptions): string {
  return createHash('sha1').update(JSON.stringify(options)).digest('hex').slice(0, 16);
}

function escapeMarkup(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveFontFamily(family: BrandingFontFamily): string {
  if (process.platform === 'win32') {
    if (family === 'serif') {
      return 'Georgia';
    }
    if (family === 'mono') {
      return 'Consolas';
    }
    return 'Segoe UI';
  }
  if (family === 'serif') {
    return 'serif';
  }
  if (family === 'mono') {
    return 'monospace';
  }
  return 'sans-serif';
}

function emSizeFor(fontSizePx: number): number {
  return Math.max(8, Math.round(fontSizePx * EM_TO_GLYPH_HEIGHT));
}

function resolvePangoWeight(weight: BrandingFontWeight): string {
  if (weight === 'bold') {
    return 'bold';
  }
  if (weight === 'medium') {
    return 'semibold';
  }
  return 'normal';
}

type SharpFactory = (typeof import('sharp'))['default'];

async function loadSharp(): Promise<SharpFactory> {
  const mod = await import('sharp');
  return mod.default;
}

interface RasterizedText {
  buffer: Buffer;
  width: number;
  height: number;
}

async function rasterizeWithSharpText(options: TextAssetOptions): Promise<RasterizedText> {
  const sharp = await loadSharp();
  const markup = `<span foreground="${options.color}" weight="${resolvePangoWeight(
    options.fontWeight,
  )}">${escapeMarkup(options.text)}</span>`;

  const image = sharp({
    text: {
      text: markup,
      // Pango font description: family followed by size in points (dpi 72 => 1pt = 1px).
      font: `${resolveFontFamily(options.fontFamily)} ${emSizeFor(options.fontSizePx)}`,
      dpi: 72,
      rgba: true,
    },
  }).png();

  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

async function rasterizeWithSharpSvg(options: TextAssetOptions): Promise<RasterizedText> {
  const sharp = await loadSharp();
  const fontSize = emSizeFor(options.fontSizePx);
  const secondaryText = options.secondaryText?.trim() ?? '';
  const secondaryFontSize = emSizeFor(options.secondaryFontSizePx ?? options.fontSizePx * 0.38);
  // Generous canvas; transparent padding is trimmed afterwards.
  const primaryWidth = fontSize * 0.75 * options.text.length;
  const secondaryWidth = secondaryFontSize * 0.75 * secondaryText.length;
  const padding = Math.ceil(fontSize * 0.8);
  const estimatedWidth = Math.ceil(Math.max(primaryWidth, secondaryWidth) + padding * 2);
  const canvasHeight = Math.ceil(
    padding + fontSize * 1.15 + (secondaryText ? secondaryFontSize * 1.45 : fontSize * 0.85) + padding,
  );
  const left = padding;
  const right = estimatedWidth - padding;
  const primaryBaseline = Math.ceil(padding + fontSize);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${estimatedWidth}" height="${canvasHeight}">
  <text x="${left}" y="${primaryBaseline}" text-anchor="start" font-family="${resolveFontFamily(
    options.fontFamily,
  )}" font-size="${fontSize}" font-weight="${BRANDING_FONT_WEIGHT_VALUES[options.fontWeight]}" fill="${options.color}">${escapeMarkup(options.text)}</text>
  ${
    secondaryText
      ? `<text x="${right}" y="${Math.ceil(primaryBaseline + secondaryFontSize * 1.35)}" text-anchor="end" font-family="${resolveFontFamily(
          options.fontFamily,
        )}" font-size="${secondaryFontSize}" font-weight="${BRANDING_FONT_WEIGHT_VALUES[options.fontWeight]}" fill="${options.color}">${escapeMarkup(secondaryText)}</text>`
      : ''
  }
</svg>`;

  const { data, info } = await sharp(Buffer.from(svg))
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });

  if (info.width < 2 || info.height < 2) {
    throw new Error('SVG text rasterization produced an empty image');
  }

  return { buffer: data, width: info.width, height: info.height };
}

function escapeDrawtextValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

function resolveDrawtextFontFile(family: BrandingFontFamily): string | null {
  if (process.platform !== 'win32') {
    return null;
  }
  const fontsDir = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts');
  if (family === 'serif') {
    return path.join(fontsDir, 'georgiab.ttf');
  }
  if (family === 'mono') {
    return path.join(fontsDir, 'consolab.ttf');
  }
  return path.join(fontsDir, 'segoeuib.ttf');
}

async function rasterizeWithDrawtext(options: TextAssetOptions): Promise<RasterizedText> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new Error('ffmpeg is not available for text rendering');
  }

  const fontSize = emSizeFor(options.fontSizePx);
  const secondaryText = options.secondaryText?.trim() ?? '';
  const secondaryFontSize = emSizeFor(options.secondaryFontSizePx ?? options.fontSizePx * 0.38);
  const canvasWidth = Math.ceil(
    Math.max(fontSize * 0.75 * options.text.length, secondaryFontSize * 0.75 * secondaryText.length) +
      fontSize * 2,
  );
  const canvasHeight = Math.ceil(
    fontSize * 1.15 + (secondaryText ? secondaryFontSize * 1.45 : fontSize * 0.85) + fontSize,
  );
  const dir = await getCacheDir();
  const outputPath = path.join(dir, `drawtext-${hashOptions(options)}.png`);

  const fontFile = resolveDrawtextFontFile(options.fontFamily);
  const drawtextParts = [
    `text='${escapeDrawtextValue(options.text)}'`,
    `fontcolor=${options.color}`,
    `fontsize=${fontSize}`,
    'x=(w-text_w)/2',
    'y=(h-text_h)/2',
  ];
  if (fontFile) {
    drawtextParts.push(`fontfile='${escapeDrawtextValue(fontFile)}'`);
  }

  const filters = [drawtextParts.join(':')];
  if (secondaryText) {
    const secondaryParts = [
      `text='${escapeDrawtextValue(secondaryText)}'`,
      `fontcolor=${options.color}`,
      `fontsize=${secondaryFontSize}`,
      'x=(w-text_w)/2',
      `y=${Math.ceil(fontSize * 1.05)}`,
    ];
    if (fontFile) {
      secondaryParts.push(`fontfile='${escapeDrawtextValue(fontFile)}'`);
    }
    filters.push(secondaryParts.join(':'));
  }

  await runFfmpegProcess(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=black@0.0:s=${canvasWidth}x${canvasHeight},format=rgba`,
    '-vf',
    filters.join(','),
    '-frames:v',
    '1',
    '-y',
    outputPath,
  ]);

  const buffer = await fs.readFile(outputPath);

  try {
    const sharp = await loadSharp();
    const { data, info } = await sharp(buffer).trim().png().toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    return { buffer, width: canvasWidth, height: canvasHeight };
  }
}

async function rasterizeText(options: TextAssetOptions): Promise<RasterizedText> {
  const attempts: Array<{ name: TextRenderer; run: () => Promise<RasterizedText> }> =
    options.secondaryText?.trim()
      ? [
          { name: 'sharp-svg', run: () => rasterizeWithSharpSvg(options) },
          { name: 'ffmpeg-drawtext', run: () => rasterizeWithDrawtext(options) },
        ]
      : [
          { name: 'sharp-text', run: () => rasterizeWithSharpText(options) },
          { name: 'sharp-svg', run: () => rasterizeWithSharpSvg(options) },
          { name: 'ffmpeg-drawtext', run: () => rasterizeWithDrawtext(options) },
        ];

  // Keep using the renderer that already worked in this session.
  if (renderedWith) {
    attempts.sort((a, b) => (a.name === renderedWith ? -1 : b.name === renderedWith ? 1 : 0));
  }

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const result = await attempt.run();
      renderedWith = attempt.name;
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : 'unknown error';
  throw new Error(`Unable to render branding text locally: ${reason}`);
}

/**
 * Add a soft dark shadow behind the glyphs so light text stays readable on bright footage.
 */
async function applyShadow(rendered: RasterizedText, fontSizePx: number): Promise<RasterizedText> {
  const sharp = await loadSharp();
  const offset = Math.max(1, Math.round(fontSizePx * 0.05));
  const blur = Math.max(0.4, fontSizePx * 0.03);
  const padding = offset * 2 + Math.ceil(blur * 2);

  const shadow = await sharp(rendered.buffer)
    .tint({ r: 0, g: 0, b: 0 })
    .blur(blur)
    .png()
    .toBuffer();

  const width = rendered.width + padding * 2;
  const height = rendered.height + padding * 2;

  const composed = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadow, left: padding + offset, top: padding + offset },
      { input: rendered.buffer, left: padding, top: padding },
    ])
    .png()
    .toBuffer();

  return { buffer: composed, width, height };
}

async function fitWidth(rendered: RasterizedText, maxWidthPx: number): Promise<RasterizedText> {
  if (rendered.width <= maxWidthPx) {
    return rendered;
  }
  const sharp = await loadSharp();
  const { data, info } = await sharp(rendered.buffer)
    .resize({ width: Math.max(2, Math.round(maxWidthPx)) })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

/**
 * Render branding text into a transparent PNG on disk and cache it for reuse
 * across every video in a batch that shares the same size and styling.
 */
export async function renderTextOverlayAsset(options: TextAssetOptions): Promise<string> {
  const key = hashOptions(options);
  const cached = assetCache.get(key);
  if (cached) {
    return cached;
  }

  let rendered = await rasterizeText(options);
  if (options.shadow) {
    rendered = await applyShadow(rendered, options.fontSizePx);
  }
  rendered = await fitWidth(rendered, options.maxWidthPx);

  const dir = await getCacheDir();
  const filePath = path.join(dir, `text-${key}.png`);
  await fs.writeFile(filePath, rendered.buffer);
  assetCache.set(key, filePath);
  return filePath;
}

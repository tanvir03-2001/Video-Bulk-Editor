import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { app } from 'electron';
import {
  type ImageEditFilter,
  type ImageEditPresetSummary,
  type ImageEditTuningConfig,
} from '../../../shared/imageEditing';

interface ParsedAttributes {
  [key: string]: string;
}

let presetCache: ImageEditPresetSummary[] | null = null;

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseAttributes(source: string): ParsedAttributes {
  const attributes: ParsedAttributes = {};
  const attributePattern = /crs:([A-Za-z0-9]+)="([^"]*)"/g;
  for (const match of source.matchAll(attributePattern)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function readNumber(attributes: ParsedAttributes, name: string): number {
  const value = Number.parseFloat(attributes[name] ?? '');
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function inferFilter(attributes: ParsedAttributes, name: string): ImageEditFilter {
  const treatment = attributes.Treatment?.toLowerCase() ?? '';
  const normalizedName = name.toLowerCase();
  if (treatment.includes('black') || treatment.includes('monochrome')) {
    return 'mono';
  }
  if (normalizedName.includes('sepia') || normalizedName.includes('van dyke')) {
    return 'sepia';
  }
  return 'none';
}

function mapTuning(attributes: ParsedAttributes): ImageEditTuningConfig {
  const exposure = readNumber(attributes, 'Exposure2012');
  const highlights = readNumber(attributes, 'Highlights2012');
  const shadows = readNumber(attributes, 'Shadows2012');
  const whites = readNumber(attributes, 'Whites2012');
  const blacks = readNumber(attributes, 'Blacks2012');
  const clarity = readNumber(attributes, 'Clarity2012');
  const dehaze = readNumber(attributes, 'Dehaze');
  const vibrance = readNumber(attributes, 'Vibrance');
  const globalSaturation = readNumber(attributes, 'ColorGradeGlobalSat');
  const saturationAdjustments = [
    'SaturationAdjustmentRed',
    'SaturationAdjustmentOrange',
    'SaturationAdjustmentYellow',
    'SaturationAdjustmentGreen',
    'SaturationAdjustmentAqua',
    'SaturationAdjustmentBlue',
    'SaturationAdjustmentPurple',
    'SaturationAdjustmentMagenta',
  ].map((name) => readNumber(attributes, name));
  const temperatureValue = attributes.Temperature;
  const temperature = temperatureValue === undefined ? null : Number.parseFloat(temperatureValue);
  const hue = readNumber(attributes, 'ColorGradeGlobalHue');
  const sharpness = readNumber(attributes, 'Sharpness');

  return {
    brightnessPercent: clamp(
      exposure * 38 + highlights * 0.2 + shadows * 0.25 + whites * 0.15 + blacks * 0.15,
      -100,
      100,
    ),
    contrastPercent: clamp(readNumber(attributes, 'Contrast2012') + clarity * 0.25 + dehaze * 0.15, -100, 100),
    saturationPercent: clamp(
      vibrance * 0.45 + globalSaturation * 0.5 + average(saturationAdjustments) * 0.35,
      -100,
      100,
    ),
    temperaturePercent:
      temperature !== null && Number.isFinite(temperature)
        ? clamp((temperature - 5500) / 15, -100, 100)
        : 0,
    hueDegrees: clamp(hue, -180, 180),
    sharpenPercent: clamp(sharpness, 0, 100),
  };
}

function readPresetName(source: string, filePath: string): string {
  const nameMatch = source.match(/<rdf:li[^>]*xml:lang="x-default">([^<]+)<\/rdf:li>/);
  return decodeXml(nameMatch?.[1]?.trim() || path.parse(filePath).name);
}

function readPresetGroup(source: string, filePath: string): string {
  const groupMatch = source.match(
    /<crs:Group>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]+)<\/rdf:li>/,
  );
  if (groupMatch?.[1]) {
    return decodeXml(groupMatch[1].trim());
  }
  return path.basename(path.dirname(filePath));
}

function parsePreset(
  source: string,
  filePath: string,
  rootPath: string,
  origin: ImageEditPresetSummary['origin'],
): ImageEditPresetSummary {
  const description = source.match(/<rdf:Description\b([^>]*)>/)?.[1] ?? '';
  const attributes = parseAttributes(description);
  const name = readPresetName(source, filePath);
  return {
    id: `${origin}/${path.relative(rootPath, filePath).split(path.sep).join('/')}`,
    name,
    group: readPresetGroup(source, filePath),
    origin,
    filter: inferFilter(attributes, name),
    tuning: mapTuning(attributes),
  };
}

async function listXmpFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listXmpFiles(entryPath)));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.xmp') {
      files.push(entryPath);
    }
  }
  return files;
}

async function resolvePresetRoot(): Promise<string> {
  const candidates = [
    path.join(app.getAppPath(), 'presets', 'lightroom', 'Presets'),
    path.join(__dirname, '..', '..', 'presets', 'lightroom', 'Presets'),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next runtime location.
    }
  }
  throw new Error('Bundled Lightroom preset library was not found.');
}

function resolveImportedPresetRoot(): string {
  return path.join(app.getPath('userData'), 'image-edit-presets');
}

export async function getImageEditPresets(): Promise<ImageEditPresetSummary[]> {
  if (presetCache) {
    return presetCache.map((preset) => ({ ...preset, tuning: { ...preset.tuning } }));
  }

  const root = await resolvePresetRoot();
  const files = await listXmpFiles(root);
  const presets: ImageEditPresetSummary[] = [];
  for (const filePath of files) {
    try {
      const source = await fs.readFile(filePath, 'utf8');
      presets.push(parsePreset(source, filePath, root, 'bundled'));
    } catch {
      // Ignore a malformed individual preset and keep the library usable.
    }
  }

  try {
    const importedRoot = resolveImportedPresetRoot();
    const importedFiles = await listXmpFiles(importedRoot);
    for (const filePath of importedFiles) {
      try {
        const source = await fs.readFile(filePath, 'utf8');
        presets.push(parsePreset(source, filePath, importedRoot, 'imported'));
      } catch {
        // Ignore a malformed individual preset and keep the library usable.
      }
    }
  } catch {
    // The user preset folder is optional.
  }

  presets.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  presetCache = presets;
  return presets.map((preset) => ({ ...preset, tuning: { ...preset.tuning } }));
}

export async function importImageEditPresets(folderPath: string): Promise<ImageEditPresetSummary[]> {
  const files = await listXmpFiles(folderPath);
  if (files.length === 0) {
    throw new Error('No .xmp preset files were found in the selected folder.');
  }

  const sourceKey = crypto.createHash('sha1').update(path.resolve(folderPath)).digest('hex').slice(0, 12);
  const importRoot = path.join(resolveImportedPresetRoot(), sourceKey);
  for (const filePath of files) {
    const relativePath = path.relative(folderPath, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      continue;
    }
    const targetPath = path.join(importRoot, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(filePath, targetPath);
  }

  presetCache = null;
  return getImageEditPresets();
}

export async function getImageEditPresetById(id: string): Promise<ImageEditPresetSummary | null> {
  const presets = await getImageEditPresets();
  return presets.find((preset) => preset.id === id) ?? null;
}

export function getImageEditPreviewSource(): string {
  return path.join(app.getAppPath(), 'presets', 'preview-source.svg');
}

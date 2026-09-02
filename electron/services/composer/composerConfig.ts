export const FAST_EXPORT_MAX_LONG_EDGE = 1080;
export const PREVIEW_MAX_LONG_EDGE = 540;
export const FAST_EXPORT_PRESET = 'veryfast';
export const PREVIEW_PRESET = 'ultrafast';
export const FAST_EXPORT_CRF = 20;
export const PREVIEW_CRF = 28;
export const FAST_EXPORT_FPS = 30;
export const FAST_EXPORT_PROXY_CRF = 28;
export const PROXY_MAX_SECONDS = 90;
export const THUMBNAIL_WIDTH = 120;
export const IMPORT_CONCURRENCY = 2;
export const SEGMENT_ENCODE_CONCURRENCY = 2;

export const COMPOSER_STEP_TOTAL = 6;

export const COMPOSER_PIPELINE_STEPS = [
  'Selecting & reading videos',
  'Generating thumbnails & proxy',
  'Reading audio',
  'Planning timeline',
  'Encoding video',
  'Finalizing export',
] as const;

export type ComposerPipelineStep = (typeof COMPOSER_PIPELINE_STEPS)[number];

/** yuv420p and libx264 require even dimensions. */
export function ensureEvenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

export function capFastExportDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  return capEncodeDimensions(width, height, FAST_EXPORT_MAX_LONG_EDGE);
}

export function capPreviewDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  return capEncodeDimensions(width, height, PREVIEW_MAX_LONG_EDGE);
}

export function capEncodeDimensions(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const safeWidth = Math.max(2, width);
  const safeHeight = Math.max(2, height);
  const longEdge = Math.max(safeWidth, safeHeight);
  if (longEdge <= maxLongEdge) {
    return {
      width: ensureEvenDimension(safeWidth),
      height: ensureEvenDimension(safeHeight),
    };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: ensureEvenDimension(safeWidth * scale),
    height: ensureEvenDimension(safeHeight * scale),
  };
}

import type {
  BrandingAspectRatio,
  BrandingConfig,
  BrandingSide,
} from '../../../shared/branding';

export interface PreviewSideDims {
  width: number;
  height: number;
}

export interface PreviewLayout {
  topPct: number;
  bottomPct: number;
  leftPct: number;
  rightPct: number;
  videoLeftPct: number;
  videoTopPct: number;
  videoWidthPct: number;
  videoHeightPct: number;
}

const PRESET_RATIOS: Record<Exclude<BrandingAspectRatio, 'source' | 'custom'>, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '2:3': 2 / 3,
  '3:2': 3 / 2,
  '21:9': 21 / 9,
};

function resolveOutputRatio(
  aspectRatio: BrandingAspectRatio,
  customWidth: number,
  customHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): number {
  if (aspectRatio === 'source') {
    return sourceWidth / Math.max(1, sourceHeight);
  }
  if (aspectRatio === 'custom') {
    return Math.max(1, customWidth) / Math.max(1, customHeight);
  }
  return PRESET_RATIOS[aspectRatio];
}

function fitPair(total: number, first: number, second: number): [number, number] {
  if (first <= 0 && second <= 0) {
    return [0, 0];
  }
  const scale = first + second > total ? total / (first + second) : 1;
  return [first * scale, second * scale];
}

/** Mirror electron canvasLayout as percentages of the output frame. */
export function resolvePreviewLayout(
  config: BrandingConfig,
  sourceWidth: number,
  sourceHeight: number,
  sideDims: Partial<Record<BrandingSide, PreviewSideDims>> = {},
): PreviewLayout {
  const outputRatio = resolveOutputRatio(
    config.canvas.aspectRatio,
    config.canvas.customWidth,
    config.canvas.customHeight,
    Math.max(1, sourceWidth),
    Math.max(1, sourceHeight),
  );
  const longEdge = 1000;
  const outputWidth = outputRatio >= 1 ? longEdge : longEdge * outputRatio;
  const outputHeight = outputRatio >= 1 ? longEdge / outputRatio : longEdge;

  const topImage = config.canvas.top.enabled ? sideDims.top : undefined;
  const bottomImage = config.canvas.bottom.enabled ? sideDims.bottom : undefined;
  const topNatural = topImage
    ? (outputWidth * topImage.height) / Math.max(1, topImage.width)
    : config.canvas.top.enabled && config.canvas.top.imagePath
      ? outputHeight * 0.12
      : 0;
  const bottomNatural = bottomImage
    ? (outputWidth * bottomImage.height) / Math.max(1, bottomImage.width)
    : config.canvas.bottom.enabled && config.canvas.bottom.imagePath
      ? outputHeight * 0.12
      : 0;
  const [topHeight, bottomHeight] = fitPair(outputHeight * 0.55, topNatural, bottomNatural);

  const videoHeight = Math.max(64, outputHeight - topHeight - bottomHeight);
  const leftImage = config.canvas.left.enabled ? sideDims.left : undefined;
  const rightImage = config.canvas.right.enabled ? sideDims.right : undefined;
  const leftNatural = leftImage
    ? (videoHeight * leftImage.width) / Math.max(1, leftImage.height)
    : config.canvas.left.enabled && config.canvas.left.imagePath
      ? outputWidth * 0.12
      : 0;
  const rightNatural = rightImage
    ? (videoHeight * rightImage.width) / Math.max(1, rightImage.height)
    : config.canvas.right.enabled && config.canvas.right.imagePath
      ? outputWidth * 0.12
      : 0;
  const [leftWidth, rightWidth] = fitPair(outputWidth * 0.55, leftNatural, rightNatural);

  const videoWidth = Math.max(64, outputWidth - leftWidth - rightWidth);

  return {
    topPct: (topHeight / outputHeight) * 100,
    bottomPct: (bottomHeight / outputHeight) * 100,
    leftPct: (leftWidth / outputWidth) * 100,
    rightPct: (rightWidth / outputWidth) * 100,
    videoLeftPct: (leftWidth / outputWidth) * 100,
    videoTopPct: (topHeight / outputHeight) * 100,
    videoWidthPct: (videoWidth / outputWidth) * 100,
    videoHeightPct: (videoHeight / outputHeight) * 100,
  };
}

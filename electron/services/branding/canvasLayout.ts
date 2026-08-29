import type {
  BrandingAspectRatio,
  BrandingCanvasConfig,
  BrandingSide,
} from '../../../shared/branding';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface SideImageSlot {
  side: BrandingSide;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface CanvasLayout {
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
  videoX: number;
  videoY: number;
  videoWidth: number;
  videoHeight: number;
  slots: SideImageSlot[];
}

const MIN_VIDEO_WIDTH = 64;
const MIN_VIDEO_HEIGHT = 64;

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

function even(value: number, minimum = 2): number {
  const rounded = Math.floor(Math.max(minimum, value) / 2) * 2;
  return Math.max(minimum, rounded);
}

function resolveRatio(
  aspectRatio: BrandingAspectRatio,
  customWidth: number,
  customHeight: number,
  source: ImageDimensions,
): number {
  if (aspectRatio === 'source') {
    return source.width / source.height;
  }
  if (aspectRatio === 'custom') {
    return Math.max(1, customWidth) / Math.max(1, customHeight);
  }
  return PRESET_RATIOS[aspectRatio];
}

function fitPair(total: number, first: number, second: number, maxFraction: number): [number, number] {
  if (first <= 0 && second <= 0) {
    return [0, 0];
  }
  const maxTotal = Math.max(0, total * maxFraction);
  const scale = first + second > maxTotal ? maxTotal / (first + second) : 1;
  return [even(first * scale, first > 0 ? 2 : 0), even(second * scale, second > 0 ? 2 : 0)];
}

/**
 * Resolve a fixed output canvas and non-overlapping edge slots.
 * Side images keep their aspect ratio; their combined size is capped so the
 * center video always remains visible.
 */
export function resolveCanvasLayout(
  source: ImageDimensions,
  canvas: BrandingCanvasConfig,
  sideImages: Partial<Record<BrandingSide, ImageDimensions>>,
): CanvasLayout {
  const sourceWidth = even(source.width);
  const sourceHeight = even(source.height);
  const ratio = resolveRatio(canvas.aspectRatio, canvas.customWidth, canvas.customHeight, {
    width: sourceWidth,
    height: sourceHeight,
  });
  const longEdge = Math.max(sourceWidth, sourceHeight);
  const outputWidth = even(ratio >= 1 ? longEdge : longEdge * ratio);
  const outputHeight = even(ratio >= 1 ? longEdge / ratio : longEdge);

  const topImage = canvas.top.enabled ? sideImages.top : undefined;
  const bottomImage = canvas.bottom.enabled ? sideImages.bottom : undefined;
  const topNaturalHeight = topImage ? (outputWidth * topImage.height) / topImage.width : 0;
  const bottomNaturalHeight = bottomImage
    ? (outputWidth * bottomImage.height) / bottomImage.width
    : 0;
  const [topHeight, bottomHeight] = fitPair(
    outputHeight - MIN_VIDEO_HEIGHT,
    topNaturalHeight,
    bottomNaturalHeight,
    1,
  );

  const videoHeight = Math.max(MIN_VIDEO_HEIGHT, outputHeight - topHeight - bottomHeight);
  const leftImage = canvas.left.enabled ? sideImages.left : undefined;
  const rightImage = canvas.right.enabled ? sideImages.right : undefined;
  const leftNaturalWidth = leftImage ? (videoHeight * leftImage.width) / leftImage.height : 0;
  const rightNaturalWidth = rightImage ? (videoHeight * rightImage.width) / rightImage.height : 0;
  const [leftWidth, rightWidth] = fitPair(
    outputWidth - MIN_VIDEO_WIDTH,
    leftNaturalWidth,
    rightNaturalWidth,
    1,
  );

  const videoWidth = Math.max(MIN_VIDEO_WIDTH, outputWidth - leftWidth - rightWidth);
  const slots: SideImageSlot[] = [];
  if (topImage && topHeight > 0) {
    slots.push({ side: 'top', width: outputWidth, height: topHeight, x: 0, y: 0 });
  }
  if (bottomImage && bottomHeight > 0) {
    slots.push({
      side: 'bottom',
      width: outputWidth,
      height: bottomHeight,
      x: 0,
      y: outputHeight - bottomHeight,
    });
  }
  if (leftImage && leftWidth > 0) {
    slots.push({
      side: 'left',
      width: leftWidth,
      height: videoHeight,
      x: 0,
      y: topHeight,
    });
  }
  if (rightImage && rightWidth > 0) {
    slots.push({
      side: 'right',
      width: rightWidth,
      height: videoHeight,
      x: outputWidth - rightWidth,
      y: topHeight,
    });
  }

  return {
    aspectRatio: ratio,
    outputWidth,
    outputHeight,
    videoX: leftWidth,
    videoY: topHeight,
    videoWidth,
    videoHeight,
    slots,
  };
}

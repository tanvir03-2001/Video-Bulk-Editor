import type { BrandingSide, OverlayPosition } from '../../../shared/branding';

export interface CanvasFilterPlan {
  outputWidth: number;
  outputHeight: number;
  videoX: number;
  videoY: number;
  videoWidth: number;
  videoHeight: number;
  zoomPercent: number;
  backgroundColor: string;
}

export interface SideImageOverlayPlan {
  side: BrandingSide;
  inputIndex: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface WatermarkOverlayPlan {
  /** FFmpeg input index of the watermark image (0 is always the source video). */
  inputIndex: number;
  /** Target width in pixels, or null to use the image as-is (pre-rendered text). */
  targetWidthPx: number | null;
  /** 0–1 multiplier applied on top of the image's own alpha channel. */
  opacity: number;
  position: OverlayPosition;
  marginXPx: number;
  marginYPx: number;
}

export interface MovingTextOverlayPlan {
  inputIndex: number;
  opacity: number;
  horizontalPeriodSeconds: number;
  verticalPeriodSeconds: number;
}

export type ScaleAlgorithm = 'lanczos' | 'bilinear';

export interface BrandingFilterGraphOptions {
  canvas: CanvasFilterPlan;
  sideImages?: SideImageOverlayPlan[];
  watermark?: WatermarkOverlayPlan | null;
  movingText?: MovingTextOverlayPlan | null;
  scaleAlgorithm?: ScaleAlgorithm;
}

export interface BrandingFilterGraph {
  filterComplex: string;
  /** Label of the final video stream, ready for `-map`. */
  outputLabel: string;
}

/** Fraction of the free space the moving text may drift from centre on each axis. */
const MOVING_TEXT_DRIFT = 0.42;

/** Phase offset so horizontal and vertical drift never align into a straight line. */
const MOVING_TEXT_PHASE = 1.7;

function formatOpacity(opacity: number): string {
  return Math.max(0, Math.min(1, opacity)).toFixed(3);
}

/**
 * Static overlay coordinates for one of the nine anchor positions.
 * Uses overlay's shorthand variables: W/H (main), w/h (overlay).
 */
export function buildPositionExpressions(
  position: OverlayPosition,
  marginXPx: number,
  marginYPx?: number,
): { x: string; y: string } {
  const marginX = Math.max(0, Math.round(marginXPx));
  const marginY = Math.max(0, Math.round(marginYPx ?? marginXPx));
  const [vertical, horizontal] = position.split('-');

  const x =
    horizontal === 'left'
      ? `${marginX}`
      : horizontal === 'right'
        ? `W-w-${marginX}`
        : `(W-w)/2`;

  const y =
    vertical === 'top' ? `${marginY}` : vertical === 'bottom' ? `H-h-${marginY}` : `(H-h)/2`;

  return { x, y };
}

/**
 * Smooth, deterministic drift path. Two sine waves with different periods keep the
 * text wandering across different areas without jumps, always inside the frame.
 */
export function buildMovingTextExpressions(
  horizontalPeriodSeconds: number,
  verticalPeriodSeconds: number,
): { x: string; y: string } {
  const horizontal = Math.max(1, horizontalPeriodSeconds);
  const vertical = Math.max(1, verticalPeriodSeconds);

  return {
    x: `(W-w)/2+${MOVING_TEXT_DRIFT}*(W-w)*sin(2*PI*t/${horizontal})`,
    y: `(H-h)/2+${MOVING_TEXT_DRIFT}*(H-h)*sin(2*PI*t/${vertical}+${MOVING_TEXT_PHASE})`,
  };
}

/**
 * Build a single filter_complex that applies every enabled overlay in one pass,
 * so the video is decoded and encoded exactly once.
 */
export function buildBrandingFilterGraph(
  options: BrandingFilterGraphOptions,
): BrandingFilterGraph | null {
  const { canvas, sideImages = [], watermark, movingText } = options;
  const scaleFlags = options.scaleAlgorithm ?? 'lanczos';
  if (!watermark && !movingText && sideImages.length === 0 && canvas.zoomPercent === 100) {
    return null;
  }

  const chains: string[] = [];
  let stageIndex = 0;
  const outputWidth = Math.max(2, Math.round(canvas.outputWidth));
  const outputHeight = Math.max(2, Math.round(canvas.outputHeight));
  const videoWidth = Math.max(2, Math.round(canvas.videoWidth));
  const videoHeight = Math.max(2, Math.round(canvas.videoHeight));
  const zoom = Math.max(0.5, Math.min(2, canvas.zoomPercent / 100));
  const coverWidth = Math.max(2, Math.round(videoWidth * zoom));
  const coverHeight = Math.max(2, Math.round(videoHeight * zoom));
  const backgroundColor = canvas.backgroundColor || 'black';

  chains.push(
    `[0:v]scale=${coverWidth}:${coverHeight}:force_original_aspect_ratio=increase:flags=${scaleFlags},pad=w='max(iw,${videoWidth})':h='max(ih,${videoHeight})':x='(ow-iw)/2':y='(oh-ih)/2':color=${backgroundColor},crop=${videoWidth}:${videoHeight}:(iw-${videoWidth})/2:(ih-${videoHeight})/2,setsar=1,format=rgba,pad=${outputWidth}:${outputHeight}:${Math.round(canvas.videoX)}:${Math.round(canvas.videoY)}:color=${backgroundColor}[canvas0]`,
  );
  let currentLabel = 'canvas0';

  for (const sideImage of sideImages) {
    const imageLabel = `side${sideImage.side}`;
    chains.push(
      `[${sideImage.inputIndex}:v]scale=${Math.max(2, Math.round(sideImage.width))}:${Math.max(2, Math.round(sideImage.height))}:force_original_aspect_ratio=decrease:flags=${scaleFlags},format=rgba,pad=${Math.max(2, Math.round(sideImage.width))}:${Math.max(2, Math.round(sideImage.height))}:(ow-iw)/2:(oh-ih)/2:color=${backgroundColor}[${imageLabel}]`,
    );
    stageIndex += 1;
    const nextLabel = `vb${stageIndex}`;
    chains.push(
      `[${currentLabel}][${imageLabel}]overlay=x=${Math.round(sideImage.x)}:y=${Math.round(sideImage.y)}:eof_action=repeat:eval=init[${nextLabel}]`,
    );
    currentLabel = nextLabel;
  }

  if (watermark) {
    const scaleStep =
      watermark.targetWidthPx && watermark.targetWidthPx > 0
        ? `scale=${Math.max(2, Math.round(watermark.targetWidthPx))}:-1:flags=${scaleFlags},`
        : '';
    chains.push(
      `[${watermark.inputIndex}:v]${scaleStep}format=rgba,colorchannelmixer=aa=${formatOpacity(watermark.opacity)}[wmimg]`,
    );

    const { x, y } = buildPositionExpressions(
      watermark.position,
      watermark.marginXPx,
      watermark.marginYPx,
    );
    stageIndex += 1;
    const nextLabel = `vb${stageIndex}`;
    chains.push(`[${currentLabel}][wmimg]overlay=x=${x}:y=${y}:eof_action=repeat:eval=init:shortest=1[${nextLabel}]`);
    currentLabel = nextLabel;
  }

  if (movingText) {
    chains.push(
      `[${movingText.inputIndex}:v]format=rgba,colorchannelmixer=aa=${formatOpacity(movingText.opacity)}[mtimg]`,
    );

    const { x, y } = buildMovingTextExpressions(
      movingText.horizontalPeriodSeconds,
      movingText.verticalPeriodSeconds,
    );
    stageIndex += 1;
    const nextLabel = `vb${stageIndex}`;
    chains.push(
      `[${currentLabel}][mtimg]overlay=x='${x}':y='${y}':eof_action=repeat:eval=frame:shortest=1[${nextLabel}]`,
    );
    currentLabel = nextLabel;
  }

  stageIndex += 1;
  const outputLabel = `vb${stageIndex}`;
  chains.push(`[${currentLabel}]format=yuv420p[${outputLabel}]`);

  return {
    filterComplex: chains.join(';'),
    outputLabel,
  };
}

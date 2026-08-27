import type { OverlayPosition } from '../../../shared/branding';

export interface WatermarkOverlayPlan {
  /** FFmpeg input index of the watermark image (0 is always the source video). */
  inputIndex: number;
  /** Target width in pixels, or null to use the image as-is (pre-rendered text). */
  targetWidthPx: number | null;
  /** 0–1 multiplier applied on top of the image's own alpha channel. */
  opacity: number;
  position: OverlayPosition;
  marginPx: number;
}

export interface MovingTextOverlayPlan {
  inputIndex: number;
  opacity: number;
  horizontalPeriodSeconds: number;
  verticalPeriodSeconds: number;
}

export interface BrandingFilterGraphOptions {
  watermark?: WatermarkOverlayPlan | null;
  movingText?: MovingTextOverlayPlan | null;
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
  marginPx: number,
): { x: string; y: string } {
  const margin = Math.max(0, Math.round(marginPx));
  const [vertical, horizontal] = position.split('-');

  const x =
    horizontal === 'left' ? `${margin}` : horizontal === 'right' ? `W-w-${margin}` : `(W-w)/2`;

  const y = vertical === 'top' ? `${margin}` : vertical === 'bottom' ? `H-h-${margin}` : `(H-h)/2`;

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
  const { watermark, movingText } = options;
  if (!watermark && !movingText) {
    return null;
  }

  const chains: string[] = [];
  let currentLabel = '0:v';
  let stageIndex = 0;

  if (watermark) {
    const scaleStep =
      watermark.targetWidthPx && watermark.targetWidthPx > 0
        ? `scale=${Math.max(2, Math.round(watermark.targetWidthPx))}:-1:flags=lanczos,`
        : '';
    chains.push(
      `[${watermark.inputIndex}:v]${scaleStep}format=rgba,colorchannelmixer=aa=${formatOpacity(watermark.opacity)}[wmimg]`,
    );

    const { x, y } = buildPositionExpressions(watermark.position, watermark.marginPx);
    stageIndex += 1;
    const nextLabel = `vb${stageIndex}`;
    chains.push(`[${currentLabel}][wmimg]overlay=x=${x}:y=${y}:eval=init[${nextLabel}]`);
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
    chains.push(`[${currentLabel}][mtimg]overlay=x='${x}':y='${y}':eval=frame[${nextLabel}]`);
    currentLabel = nextLabel;
  }

  return {
    filterComplex: chains.join(';'),
    outputLabel: currentLabel,
  };
}

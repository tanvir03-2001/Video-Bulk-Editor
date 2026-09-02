import type { ImageEditFilter, ImageEditTuningConfig } from '../../shared/imageEditing';
import { DEFAULT_IMAGE_EDIT_TUNING } from '../../shared/imageEditing';

export interface VideoColorGradeInput {
  filter: ImageEditFilter;
  tuning: Partial<ImageEditTuningConfig> | ImageEditTuningConfig;
}

interface FilterAdjustment {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  grayscale: boolean;
  sepia: boolean;
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

function isIdentityGrade(filter: ImageEditFilter, tuning: ImageEditTuningConfig): boolean {
  if (filter !== 'none') {
    return false;
  }
  return (
    tuning.brightnessPercent === 0 &&
    tuning.contrastPercent === 0 &&
    tuning.saturationPercent === 0 &&
    tuning.temperaturePercent === 0 &&
    tuning.hueDegrees === 0 &&
    tuning.sharpenPercent === 0
  );
}

/**
 * Build an FFmpeg filter chain (no surrounding labels) that approximates the
 * image-edit Sharp color grade for video frames.
 */
export function buildColorGradeFilterChain(input: VideoColorGradeInput | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const tuning: ImageEditTuningConfig = {
    ...DEFAULT_IMAGE_EDIT_TUNING,
    ...input.tuning,
  };
  if (isIdentityGrade(input.filter, tuning)) {
    return null;
  }

  const filter = getFilterAdjustment(input.filter);
  const brightness =
    filter.brightness * Math.max(0.1, 1 + tuning.brightnessPercent / 100);
  const saturation =
    filter.saturation * Math.max(0, 1 + tuning.saturationPercent / 100);
  const contrast = filter.contrast * Math.max(0.1, 1 + tuning.contrastPercent / 100);
  const temperature = Math.max(-100, Math.min(100, filter.temperature + tuning.temperaturePercent));
  const hueDegrees = Math.max(-180, Math.min(180, tuning.hueDegrees));

  const parts: string[] = [];

  // eq brightness is -1..1 offset around 0; convert multiplier to offset.
  const eqBrightness = Math.max(-1, Math.min(1, brightness - 1));
  parts.push(
    `eq=brightness=${eqBrightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`,
  );

  if (hueDegrees !== 0) {
    parts.push(`hue=h=${hueDegrees.toFixed(2)}`);
  }

  if (temperature !== 0) {
    const amount = Math.abs(temperature) / 100;
    const warm = temperature > 0;
    const rs = warm ? amount * 0.25 : -amount * 0.15;
    const bs = warm ? -amount * 0.15 : amount * 0.25;
    parts.push(`colorbalance=rs=${rs.toFixed(3)}:bs=${bs.toFixed(3)}`);
  }

  if (filter.grayscale) {
    parts.push('hue=s=0');
  } else if (filter.sepia) {
    parts.push(
      'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
    );
  }

  if (tuning.sharpenPercent > 0) {
    const amount = 0.5 + (tuning.sharpenPercent / 100) * 1.5;
    parts.push(`unsharp=5:5:${amount.toFixed(2)}:5:5:0.0`);
  }

  return parts.join(',');
}

export function hasColorGrade(input: VideoColorGradeInput | null | undefined): boolean {
  return buildColorGradeFilterChain(input) !== null;
}

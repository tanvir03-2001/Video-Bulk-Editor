import {
  findLabelDefinition,
  SAFE_CONTRAST_LABEL,
  scoreToPercent,
} from './classificationConfig';
import type { ModelClassificationResult } from './localRiskModel';

/**
 * Whether a classified frame exceeds the Allow % threshold on any risk category.
 */
export function isFrameFlagged(result: ModelClassificationResult): boolean {
  return result.reasons.length > 0;
}

/**
 * Highest rounded risk percent across all risk labels (excluding safe contrast).
 */
export function getMaxRiskPercent(result: ModelClassificationResult): number {
  let maxPercent = 0;

  for (const [label, score] of Object.entries(result.scores)) {
    if (label === SAFE_CONTRAST_LABEL) {
      continue;
    }
    if (!findLabelDefinition(label)) {
      continue;
    }
    maxPercent = Math.max(maxPercent, scoreToPercent(score));
  }

  return maxPercent;
}

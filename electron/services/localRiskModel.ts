import {
  findLabelDefinition,
  getCandidateLabels,
  getClassificationConfig,
  getRuntimeAllowPercent,
  isRiskLabelFlagged,
  SAFE_CONTRAST_LABEL,
  type ThresholdKey,
} from './classificationConfig';

export interface DetectionResult {
  category: string;
  confidence: number;
}

export interface ModelClassificationResult {
  detections: DetectionResult[];
  scores: Record<string, number>;
  reasons: string[];
}

type ZeroShotOutput = Array<{ label: string; score: number }>;

type ZeroShotPipeline = (
  image: string,
  labels: string[],
  options?: { hypothesis_template?: string },
) => Promise<ZeroShotOutput>;

let pipelinePromise: Promise<ZeroShotPipeline> | null = null;
let configuredCacheDir: string | null = null;

/**
 * Configure transformers.js cache directory before the pipeline loads.
 * Safe to call multiple times; only the first successful load uses the cache.
 */
export function configureModelCacheDir(cacheDir: string | null | undefined): void {
  if (!cacheDir || cacheDir.trim() === '') {
    return;
  }
  configuredCacheDir = cacheDir.trim();
}

async function loadPipeline(): Promise<ZeroShotPipeline> {
  const config = getClassificationConfig();
  const cacheDir = config.modelCacheDir || configuredCacheDir;

  // Dynamic import keeps esbuild from trying to bundle the heavy package.
  const transformers = await import('@xenova/transformers');

  if (cacheDir) {
    transformers.env.cacheDir = cacheDir;
  }
  // Prefer local cache after first download; allow offline reuse.
  transformers.env.allowLocalModels = true;

  console.log(`[Image Classifier] Loading model: ${config.modelId}`);
  const classifier = (await transformers.pipeline(
    'zero-shot-image-classification',
    config.modelId,
  )) as ZeroShotPipeline;
  console.log('[Image Classifier] Model loaded');
  return classifier;
}

function getPipeline(): Promise<ZeroShotPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = loadPipeline().catch((error) => {
      pipelinePromise = null;
      throw error;
    });
  }
  return pipelinePromise;
}

/**
 * Run local CLIP zero-shot classification on a single image path.
 * Returns real model scores only — never fabricated confidences.
 */
export async function classifyImageWithModel(
  imagePath: string,
): Promise<ModelClassificationResult> {
  const config = getClassificationConfig();
  const allowPercent = getRuntimeAllowPercent();
  const classifier = await getPipeline();
  const labels = getCandidateLabels();

  const outputs = await classifier(imagePath, labels);

  const scores: Record<string, number> = {};
  for (const item of outputs) {
    scores[item.label] = item.score;
  }

  const safeScore = scores[SAFE_CONTRAST_LABEL] ?? 0;
  const detections: DetectionResult[] = [];
  const reasonSet = new Set<string>();

  for (const item of outputs) {
    if (item.label === SAFE_CONTRAST_LABEL) {
      continue;
    }

    const definition = findLabelDefinition(item.label);
    if (!definition) {
      continue;
    }

    const threshold = config.thresholds[definition.thresholdKey as ThresholdKey];
    if (!isRiskLabelFlagged(item.score, threshold, safeScore, allowPercent)) {
      continue;
    }

    for (const reason of definition.reasons) {
      reasonSet.add(reason);
      detections.push({
        category: reason,
        confidence: item.score,
      });
    }

    if (definition.copyrightRiskIndicator) {
      reasonSet.add('potential_copyright_risk');
      reasonSet.add('copyright_risk_indicator');
      detections.push({
        category: 'potential_copyright_risk',
        confidence: item.score,
      });
    }
  }

  // Deduplicate detections by category, keeping highest confidence
  const byCategory = new Map<string, DetectionResult>();
  for (const detection of detections) {
    const existing = byCategory.get(detection.category);
    if (!existing || detection.confidence > existing.confidence) {
      byCategory.set(detection.category, detection);
    }
  }

  return {
    detections: [...byCategory.values()],
    scores,
    reasons: [...reasonSet],
  };
}

/** Reset cached pipeline (useful for tests / reconfiguration). */
export function resetRiskModelForTests(): void {
  pipelinePromise = null;
  configuredCacheDir = null;
}

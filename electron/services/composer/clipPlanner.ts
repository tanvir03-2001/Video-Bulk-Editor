import { randomUUID } from 'node:crypto';
import {
  COMPOSER_AUDIO_DELAY_SECONDS,
  COMPOSER_DEFAULT_VOLUME_PERCENT,
  COMPOSER_FILLER_CLIP_SECONDS,
  COMPOSER_TRANSITION_SECONDS,
  computeEffectiveTimelineDuration,
  type ComposerClip,
} from '../../../shared/composer';

export interface PlannerVideoInput {
  path: string;
  name: string;
  durationSeconds: number;
}

export interface PlannedTimeline {
  clips: ComposerClip[];
  targetDurationSeconds: number;
  audioDurationSeconds: number;
}

interface BuildTimelineOptions {
  videos: PlannerVideoInput[];
  audioDurationSeconds: number;
  userClips?: ComposerClip[];
  onProgress?: (message: string) => void;
}

function resolveTransitionSeconds(clipDurations: number[]): number {
  if (clipDurations.length < 2 || COMPOSER_TRANSITION_SECONDS <= 0) {
    return 0;
  }
  const minClipDuration = Math.min(...clipDurations);
  const maxAllowed = Math.max(0.1, minClipDuration / 2 - 0.05);
  return Math.max(0.1, Math.min(COMPOSER_TRANSITION_SECONDS, maxAllowed));
}

function buildPrimaryClips(videos: PlannerVideoInput[]): ComposerClip[] {
  let offset = 0;
  return videos.map((video) => {
    const durationSeconds = Math.max(0.1, video.durationSeconds);
    const clip: ComposerClip = {
      id: randomUUID(),
      sourcePath: video.path,
      sourceName: video.name,
      startSeconds: 0,
      durationSeconds,
      timelineOffset: offset,
      volumePercent: COMPOSER_DEFAULT_VOLUME_PERCENT,
      muted: false,
      isFiller: false,
    };
    offset += durationSeconds;
    return clip;
  });
}

/**
 * Append short cuts from source videos (round-robin, staggered offsets) until
 * effective timeline duration reaches the audio target. No freeze frames.
 */
function appendAutoCutExtensions(
  clips: ComposerClip[],
  videos: PlannerVideoInput[],
  targetDurationSeconds: number,
  onProgress?: (message: string) => void,
): ComposerClip[] {
  const result = [...clips];
  const cutCountsByPath = new Map<string, number>();
  let extensionCount = 0;
  let addedSeconds = 0;
  const maxExtensions = 500;

  while (extensionCount < maxExtensions) {
    const durations = result.map((clip) => clip.durationSeconds);
    const transitionSeconds = resolveTransitionSeconds(durations);
    const effective = computeEffectiveTimelineDuration(result, transitionSeconds);
    const remainingEffective = targetDurationSeconds - effective;

    if (remainingEffective <= 0.05) {
      break;
    }

    // Adding one more clip introduces one more transition overlap of transitionSeconds.
    // Clip length must cover remainingEffective plus that new overlap.
    const nextTransition =
      result.length >= 1
        ? resolveTransitionSeconds([...durations, COMPOSER_FILLER_CLIP_SECONDS])
        : 0;
    const neededLength = remainingEffective + (result.length >= 1 ? nextTransition : 0);
    const video = videos[extensionCount % videos.length];
    const sourceDuration = Math.max(0.1, video.durationSeconds);
    const cutLength = Math.min(
      COMPOSER_FILLER_CLIP_SECONDS,
      sourceDuration,
      Math.max(0.1, neededLength),
    );

    const cutIndex = cutCountsByPath.get(video.path) ?? 0;
    cutCountsByPath.set(video.path, cutIndex + 1);

    const maxStart = Math.max(0, sourceDuration - cutLength);
    const startSeconds =
      maxStart <= 0.05
        ? 0
        : (cutIndex * COMPOSER_FILLER_CLIP_SECONDS) % Math.max(0.1, maxStart);

    const lastClip = result[result.length - 1];
    const timelineOffset = lastClip
      ? lastClip.timelineOffset + lastClip.durationSeconds
      : 0;

    result.push({
      id: randomUUID(),
      sourcePath: video.path,
      sourceName: video.name,
      startSeconds,
      durationSeconds: cutLength,
      timelineOffset,
      volumePercent: COMPOSER_DEFAULT_VOLUME_PERCENT,
      muted: false,
      isFiller: true,
    });

    extensionCount += 1;
    addedSeconds += cutLength;
  }

  if (extensionCount > 0) {
    onProgress?.(
      `Auto-cut extension: ${extensionCount} clip${extensionCount === 1 ? '' : 's'} (+${addedSeconds.toFixed(1)}s)`,
    );
  }

  return normalizeClipTimeline(result);
}

export async function buildComposerTimeline(
  options: BuildTimelineOptions,
): Promise<PlannedTimeline> {
  const { videos, audioDurationSeconds, userClips, onProgress } = options;

  if (videos.length === 0) {
    throw new Error('Add at least one video');
  }
  if (audioDurationSeconds <= 0) {
    throw new Error('Audio duration must be greater than zero');
  }

  const targetDurationSeconds = COMPOSER_AUDIO_DELAY_SECONDS + audioDurationSeconds;
  const baseClips =
    userClips && userClips.length > 0
      ? [...userClips]
          .filter((clip) => !clip.isFiller)
          .sort((a, b) => a.timelineOffset - b.timelineOffset)
      : buildPrimaryClips(videos);

  const clips =
    baseClips.length === 0
      ? buildPrimaryClips(videos)
      : appendAutoCutExtensions(
          normalizeClipTimeline(baseClips),
          videos,
          targetDurationSeconds,
          onProgress,
        );

  return {
    clips,
    targetDurationSeconds,
    audioDurationSeconds,
  };
}

export function normalizeClipTimeline(clips: ComposerClip[]): ComposerClip[] {
  const sorted = [...clips].sort((a, b) => a.timelineOffset - b.timelineOffset);
  let cursor = 0;
  return sorted.map((clip) => {
    const next = { ...clip, timelineOffset: cursor };
    cursor += clip.durationSeconds;
    return next;
  });
}

import { randomUUID } from 'node:crypto';
import {
  COMPOSER_AUDIO_DELAY_SECONDS,
  COMPOSER_DEFAULT_VOLUME_PERCENT,
  COMPOSER_TRANSITION_SECONDS,
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
      ? [...userClips].sort((a, b) => a.timelineOffset - b.timelineOffset)
      : buildPrimaryClips(videos);

  const clips = [...baseClips];

  const placedDuration = clips.reduce((sum, clip) => sum + clip.durationSeconds, 0);
  const remaining = targetDurationSeconds - placedDuration;

  if (remaining > 0.05) {
    const futureSegmentCount = clips.length + 1;
    const transitionOverlap = Math.max(0, futureSegmentCount - 1) * COMPOSER_TRANSITION_SECONDS;
    const lastPrimary =
      [...baseClips].reverse().find((clip) => !clip.isFiller) ?? baseClips[baseClips.length - 1];
    const source =
      videos.find((video) => video.path === lastPrimary.sourcePath) ?? videos[videos.length - 1];
    const sourceDuration = Math.max(0.1, source.durationSeconds);
    const lastClip = clips[clips.length - 1];
    const timelineOffset = lastClip ? lastClip.timelineOffset + lastClip.durationSeconds : 0;
    const fillerDuration = remaining + transitionOverlap;

    onProgress?.(`Freeze-frame filler: ${fillerDuration.toFixed(1)}s`);

    clips.push({
      id: randomUUID(),
      sourcePath: source.path,
      sourceName: source.name,
      startSeconds: Math.max(0, sourceDuration - 0.1),
      durationSeconds: fillerDuration,
      timelineOffset,
      volumePercent: COMPOSER_DEFAULT_VOLUME_PERCENT,
      muted: true,
      isFiller: true,
    });
  }

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

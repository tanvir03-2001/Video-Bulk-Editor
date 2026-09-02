import type { ComposerClip } from '../../../shared/composer';

export interface TimelineClipPosition {
  clip: ComposerClip;
  localSeconds: number;
}

export function resolveClipAtTimeline(
  clips: ComposerClip[],
  timelineSeconds: number,
): TimelineClipPosition | null {
  if (clips.length === 0) {
    return null;
  }

  const sorted = [...clips].sort((a, b) => a.timelineOffset - b.timelineOffset);
  for (const clip of sorted) {
    const end = clip.timelineOffset + clip.durationSeconds;
    if (timelineSeconds >= clip.timelineOffset && timelineSeconds < end) {
      return {
        clip,
        localSeconds: timelineSeconds - clip.timelineOffset,
      };
    }
  }

  const last = sorted[sorted.length - 1];
  return {
    clip: last,
    localSeconds: Math.max(0, last.durationSeconds - 0.05),
  };
}

export function timelineSecondsFromClip(
  clip: ComposerClip,
  sourceSeconds: number,
): number {
  return clip.timelineOffset + Math.max(0, sourceSeconds - clip.startSeconds);
}

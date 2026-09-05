import type { SubtitleDesignId } from './branding';

export interface SubtitleDesignMeta {
  id: SubtitleDesignId;
  label: string;
  description: string;
}

/** Catalog of selectable caption looks (preview + ASS export). */
export const SUBTITLE_DESIGNS: readonly SubtitleDesignMeta[] = [
  {
    id: 'reels',
    label: 'Reels',
    description: 'Bold white captions with cyan active-word highlight.',
  },
  {
    id: 'cinematic-kinetic',
    label: 'Cinematic Kinetic',
    description: 'Heavy condensed type with orange–yellow keyword pop.',
  },
] as const;

export function getSubtitleDesignMeta(id: SubtitleDesignId): SubtitleDesignMeta {
  return SUBTITLE_DESIGNS.find((design) => design.id === id) ?? SUBTITLE_DESIGNS[0];
}

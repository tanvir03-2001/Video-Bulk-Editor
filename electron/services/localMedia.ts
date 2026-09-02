import path from 'node:path';

/** Build a renderer-safe URL for absolute local files (Windows drive letters included). */
export function toLocalMediaUrl(filePath: string): string {
  return `local-media://open?path=${encodeURIComponent(path.normalize(filePath))}`;
}

export function parseLocalMediaUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  const filePath = decodeURIComponent(url.searchParams.get('path') ?? '');
  if (!filePath) {
    throw new Error('Missing media path');
  }
  return path.normalize(filePath);
}

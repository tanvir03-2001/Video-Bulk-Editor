import fs from 'node:fs/promises';
import path from 'node:path';
import type { VideoFile } from '../../shared/ipc';

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.webm',
  '.m4v',
  '.mpeg',
  '.mpg',
  '.wmv',
  '.flv',
  '.3gp',
]);

export async function scanVideosInFolder(folderPath: string): Promise<VideoFile[]> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const videos: VideoFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(extension)) {
      continue;
    }

    videos.push({
      name: entry.name,
      path: path.join(folderPath, entry.name),
      extension,
    });
  }

  videos.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return videos;
}

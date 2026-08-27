import fs from 'node:fs/promises';
import path from 'node:path';
import type { ImageFile } from '../../shared/ipc';
import { isSupportedImageExtension } from './classificationConfig';

/**
 * Non-recursive scan: only files directly inside folderPath.
 * Skips directories (including safe-images / flagged-images).
 */
export async function scanImagesInFolder(folderPath: string): Promise<ImageFile[]> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const images: ImageFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (!isSupportedImageExtension(entry.name)) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    images.push({
      name: entry.name,
      path: path.join(folderPath, entry.name),
      extension,
    });
  }

  images.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return images;
}

import fs from 'node:fs';
import path from 'node:path';

const FFMPEG_MISSING_MESSAGE =
  'FFmpeg is required to process videos. Please install/configure FFmpeg and make sure ffmpeg and ffprobe are available.';

function exists(filePath: string | null | undefined): filePath is string {
  return typeof filePath === 'string' && filePath.length > 0 && fs.existsSync(filePath);
}

function isInsideAsarArchive(filePath: string): boolean {
  return filePath.includes(`${path.sep}app.asar${path.sep}`) || filePath.includes('/app.asar/');
}

/**
 * Resolve a spawnable binary path.
 * Electron can report files inside app.asar as existing via existsSync, but
 * spawn() cannot execute them — they must come from app.asar.unpacked or
 * extraResources.
 */
function resolveExistingBinaryPath(filePath: string | null | undefined): string | null {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return null;
  }

  if (isInsideAsarArchive(filePath)) {
    const unpackedPath = filePath
      .replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
      .replace('/app.asar/', '/app.asar.unpacked/');
    if (exists(unpackedPath) && !isInsideAsarArchive(unpackedPath)) {
      return unpackedPath;
    }
    return null;
  }

  return exists(filePath) ? filePath : null;
}

function isElectronPackaged(): boolean {
  try {
    // Lazy require so non-Electron scripts can still resolve package binaries.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as { app?: { isPackaged?: boolean } };
    return Boolean(electron.app?.isPackaged);
  } catch {
    return false;
  }
}

function resolveFromResources(binaryName: string): string | null {
  if (!isElectronPackaged()) {
    return null;
  }
  const candidate = path.join(process.resourcesPath, 'ffmpeg', binaryName);
  return exists(candidate) ? candidate : null;
}

function resolveFfmpegFromPackage(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegPath = require('ffmpeg-static') as string | null;
    return resolveExistingBinaryPath(ffmpegPath);
  } catch {
    return null;
  }
}

function resolveFfprobeFromPackage(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobe = require('ffprobe-static') as { path?: string };
    return resolveExistingBinaryPath(ffprobe.path);
  } catch {
    return null;
  }
}

export function getFfmpegPath(): string | null {
  return (
    resolveFromResources(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg') ??
    resolveFfmpegFromPackage()
  );
}

export function getFfprobePath(): string | null {
  return (
    resolveFromResources(process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe') ??
    resolveFfprobeFromPackage()
  );
}

/** FFmpeg on Windows accepts forward slashes and avoids pattern parsing issues. */
export function toFfmpegPath(filePath: string): string {
  return process.platform === 'win32' ? filePath.replace(/\\/g, '/') : filePath;
}

export function assertFfmpegAvailable(): { available: boolean; error: string | null } {
  const ffmpeg = getFfmpegPath();
  const ffprobe = getFfprobePath();

  if (!ffmpeg || !ffprobe) {
    return { available: false, error: FFMPEG_MISSING_MESSAGE };
  }

  return { available: true, error: null };
}

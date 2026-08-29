export function estimateRemainingMs(
  elapsedMs: number,
  progressPercent: number,
  active: boolean,
): number | null {
  if (!active || elapsedMs <= 0 || progressPercent <= 0 || progressPercent >= 100) {
    return null;
  }

  return Math.max(0, (elapsedMs / progressPercent) * (100 - progressPercent));
}

export function formatEstimatedRemaining(
  elapsedMs: number,
  progressPercent: number,
  active: boolean,
): string {
  if (!active) {
    return progressPercent >= 100 ? 'Complete' : '—';
  }
  if (progressPercent <= 0 || elapsedMs <= 0) {
    return 'Calculating…';
  }
  if (progressPercent >= 100) {
    return 'Finishing…';
  }

  const remainingMs = estimateRemainingMs(elapsedMs, progressPercent, active);
  if (remainingMs === null) {
    return 'Calculating…';
  }

  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  if (remainingMinutes < 1) {
    return '<1 min left';
  }
  if (remainingMinutes < 60) {
    return `${remainingMinutes} min left`;
  }

  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`;
}

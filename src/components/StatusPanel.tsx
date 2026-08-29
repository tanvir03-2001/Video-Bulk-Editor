function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

interface StatusPanelProps {
  statusLabel: string;
  currentFile: string | null;
  elapsedMs: number;
  message: string | null;
  showTiming: boolean;
  isActive: boolean;
}

export function StatusPanel({
  statusLabel,
  currentFile,
  elapsedMs,
  message,
  showTiming,
  isActive,
}: StatusPanelProps) {
  return (
    <div className="grid gap-2.5 text-sm sm:grid-cols-3" aria-live="polite">
      <div className="rounded-md border border-surface-border bg-surface px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">Status</p>
        <p className="mt-1 truncate font-semibold text-white">{statusLabel}</p>
        {message ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{message}</p>
        ) : null}
      </div>
      <div className="rounded-md border border-surface-border bg-surface px-3 py-2.5 sm:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">Current file</p>
            <p
              className="mt-1 truncate font-mono text-sm leading-relaxed text-slate-100"
              title={currentFile ?? undefined}
            >
              {currentFile ?? (isActive ? 'Starting…' : '—')}
            </p>
          </div>
          {showTiming ? (
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium tracking-readable text-slate-400">Time</p>
              <p className="mt-1 font-mono text-sm tabular-nums tracking-readable text-white">
                {formatElapsed(elapsedMs)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

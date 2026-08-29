interface ProgressPanelProps {
  progressPercent: number;
  currentImageIndex: number;
  currentImageTotal: number;
  isProcessing: boolean;
  activityLabel?: string;
  stepLabel?: string | null;
  estimatedRemaining?: string;
}

export function ProgressPanel({
  progressPercent,
  currentImageIndex,
  currentImageTotal,
  isProcessing,
  activityLabel = 'Current',
  stepLabel = null,
  estimatedRemaining,
}: ProgressPanelProps) {
  const clamped = Math.max(0, Math.min(100, progressPercent));

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-mono text-lg font-semibold tabular-nums tracking-tight text-white">
            {clamped.toFixed(1)}%
          </span>
          {stepLabel ? (
            <span className="truncate rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-sky-300">{stepLabel}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isProcessing && currentImageTotal > 0 ? (
            <span className="tabular-nums tracking-readable text-slate-300">
              {activityLabel} {currentImageIndex}/{currentImageTotal}
            </span>
          ) : null}
          {estimatedRemaining ? (
            <span className="font-medium text-sky-300">{estimatedRemaining}</span>
          ) : null}
        </div>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-label="Processing progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        <div
          className="h-full rounded-full bg-accent shadow-[0_0_10px_rgba(59,130,246,0.35)] transition-[width] duration-200"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

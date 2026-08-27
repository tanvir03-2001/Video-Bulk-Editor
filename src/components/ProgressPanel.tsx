interface ProgressPanelProps {
  progressPercent: number;
  currentImageIndex: number;
  currentImageTotal: number;
  isProcessing: boolean;
  activityLabel?: string;
  stepLabel?: string | null;
}

export function ProgressPanel({
  progressPercent,
  currentImageIndex,
  currentImageTotal,
  isProcessing,
  activityLabel = 'Current',
  stepLabel = null,
}: ProgressPanelProps) {
  const clamped = Math.max(0, Math.min(100, progressPercent));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-semibold tabular-nums tracking-readable text-white">
            {clamped.toFixed(1)}%
          </span>
          {stepLabel ? (
            <span className="truncate font-medium tracking-readable text-sky-300">{stepLabel}</span>
          ) : null}
        </div>
        {isProcessing && currentImageTotal > 0 ? (
          <span className="shrink-0 tabular-nums tracking-readable text-slate-300">
            {activityLabel} {currentImageIndex}/{currentImageTotal}
          </span>
        ) : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

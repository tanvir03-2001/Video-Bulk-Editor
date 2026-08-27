interface FolderControlsProps {
  selectedFolder: string | null;
  message: string | null;
  videoCount: number;
  allowPercent: number;
  canStart: boolean;
  canCancel: boolean;
  canSelectFolder: boolean;
  onSelectFolder: () => void;
  onStart: () => void;
  onCancel: () => void;
  onAllowPercentChange: (value: number) => void;
}

const btn =
  'rounded-md px-3.5 py-2 text-sm font-medium tracking-readable text-white transition disabled:cursor-not-allowed disabled:opacity-40';

export function FolderControls({
  selectedFolder,
  message,
  videoCount,
  allowPercent,
  canStart,
  canCancel,
  canSelectFolder,
  onSelectFolder,
  onStart,
  onCancel,
  onAllowPercentChange,
}: FolderControlsProps) {
  return (
    <div className="space-y-2.5">
      <div className="rounded-md border border-surface-border bg-surface px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="video-allow-percent" className="text-sm font-medium tracking-readable text-slate-200">
            Allow %
          </label>
          <span className="font-mono text-sm tabular-nums text-white">{allowPercent}%</span>
        </div>
        <input
          id="video-allow-percent"
          type="range"
          min={5}
          max={90}
          step={5}
          value={allowPercent}
          disabled={!canSelectFolder}
          onChange={(event) => {
            onAllowPercentChange(Number(event.target.value));
          }}
          className="mt-2 w-full accent-accent disabled:opacity-40"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Scores above {allowPercent}% → flagged. At or below → safe. Per-video frame check with
          up to 5 retries. Uses rounded whole percents.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectFolder}
          disabled={!canSelectFolder}
          className={`${btn} bg-accent hover:bg-accent-muted`}
        >
          Select Folder
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className={`${btn} bg-emerald-600 hover:bg-emerald-500`}
        >
          Start
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!canCancel}
          className={`${btn} bg-rose-700 hover:bg-rose-600`}
        >
          Cancel
        </button>
      </div>

      <div className="rounded-md border border-surface-border bg-surface px-3 py-2.5">
        <p
          className="truncate font-mono text-sm leading-relaxed text-slate-100"
          title={selectedFolder ?? undefined}
        >
          {selectedFolder ?? 'No folder selected'}
        </p>
        {videoCount > 0 ? (
          <p className="mt-1 text-sm leading-relaxed text-emerald-300">
            {videoCount} video{videoCount === 1 ? '' : 's'}
          </p>
        ) : null}
        {message ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-300">{message}</p>
        ) : null}
      </div>
    </div>
  );
}

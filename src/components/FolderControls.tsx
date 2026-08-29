import { Button, Panel } from './ui/ui';

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
  showThreshold?: boolean;
}

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
  showThreshold = true,
}: FolderControlsProps) {
  return (
    <div className="space-y-2.5">
      {showThreshold ? (
        <Panel className="bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="video-allow-percent" className="text-xs font-medium text-slate-300">
            Allow %
          </label>
          <span className="font-mono text-xs tabular-nums text-sky-300">{allowPercent}%</span>
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
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          Scores above {allowPercent}% → flagged. At or below → safe. Per-video frame check with
          up to 5 retries. Uses rounded whole percents.
        </p>
        </Panel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon="folder"
          onClick={onSelectFolder}
          disabled={!canSelectFolder}
        >
          Select Folder
        </Button>
        <Button
          variant="success"
          icon="play"
          onClick={onStart}
          disabled={!canStart}
        >
          Start
        </Button>
        <Button
          variant="danger"
          icon="stop"
          onClick={onCancel}
          disabled={!canCancel}
        >
          Cancel
        </Button>
      </div>

      <Panel className="bg-surface p-3">
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
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{message}</p>
        ) : null}
      </Panel>
    </div>
  );
}

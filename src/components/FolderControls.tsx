import { Button, Panel, RangeField } from './ui/ui';

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
          <RangeField
            id="video-allow-percent"
            label="Allow %"
            value={allowPercent}
            min={5}
            max={90}
            step={5}
            disabled={!canSelectFolder}
            onChange={onAllowPercentChange}
            formatValue={(value) => `${value}%`}
            hint={`Scores above ${allowPercent}% → flagged. At or below → safe. Per-video frame check with up to 5 retries.`}
          />
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

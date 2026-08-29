import type { ImageClassificationProgress } from '../../shared/ipc';
import { Button, Panel } from './ui/ui';

interface ImageClassificationPanelProps {
  progress: ImageClassificationProgress;
  imageCount: number;
  videoCount: number;
  busy: boolean;
  allowPercent: number;
  canSelectFolder: boolean;
  canClassifyImages: boolean;
  canClassifyVideos: boolean;
  canCancel: boolean;
  onSelectFolder: () => void;
  onClassifyImages: () => void;
  onClassifyVideos: () => void;
  onCancel: () => void;
  onAllowPercentChange: (value: number) => void;
  showThreshold?: boolean;
}

export function ImageClassificationPanel({
  progress,
  imageCount,
  videoCount,
  busy,
  allowPercent,
  canSelectFolder,
  canClassifyImages,
  canClassifyVideos,
  canCancel,
  onSelectFolder,
  onClassifyImages,
  onClassifyVideos,
  onCancel,
  onAllowPercentChange,
  showThreshold = true,
}: ImageClassificationPanelProps) {
  return (
    <div className="space-y-2.5">
      {showThreshold ? (
        <Panel className="bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="allow-percent" className="text-xs font-medium text-slate-300">
            Allow %
          </label>
          <span className="font-mono text-xs tabular-nums text-sky-300">{allowPercent}%</span>
        </div>
        <input
          id="allow-percent"
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
          Scores above {allowPercent}% → flagged. At or below → safe. Uses rounded whole
          percents. Any sampled frame can flag a video. Includes watermark/logo/character
          checks too.
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
          icon="image"
          onClick={onClassifyImages}
          disabled={!canClassifyImages}
        >
          Classify Image
        </Button>
        <Button
          variant="success"
          icon="video"
          onClick={onClassifyVideos}
          disabled={!canClassifyVideos}
        >
          Classify Video
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
          title={progress.selectedFolder ?? undefined}
        >
          {progress.selectedFolder ?? 'No folder selected'}
        </p>
        {progress.selectedFolder && (imageCount > 0 || videoCount > 0) && !busy ? (
          <p className="mt-1 text-sm leading-relaxed text-emerald-300">
            {imageCount > 0 ? `${imageCount} image${imageCount === 1 ? '' : 's'}` : null}
            {imageCount > 0 && videoCount > 0 ? ' · ' : null}
            {videoCount > 0 ? `${videoCount} video${videoCount === 1 ? '' : 's'}` : null}
          </p>
        ) : null}
        {progress.message ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{progress.message}</p>
        ) : null}
      </Panel>
    </div>
  );
}

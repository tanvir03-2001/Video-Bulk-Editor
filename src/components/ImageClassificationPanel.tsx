import type { ImageClassificationProgress } from '../../shared/ipc';

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
}

const btn =
  'rounded-md px-3.5 py-2 text-sm font-medium tracking-readable text-white transition disabled:cursor-not-allowed disabled:opacity-40';

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
}: ImageClassificationPanelProps) {
  return (
    <div className="space-y-2.5">
      <div className="rounded-md border border-surface-border bg-surface px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="allow-percent" className="text-sm font-medium tracking-readable text-slate-200">
            Allow %
          </label>
          <span className="font-mono text-sm tabular-nums text-white">{allowPercent}%</span>
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
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Scores above {allowPercent}% → flagged. At or below → safe. Uses rounded whole
          percents. Any sampled frame can flag a video. Includes watermark/logo/character
          checks too.
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
          onClick={onClassifyImages}
          disabled={!canClassifyImages}
          className={`${btn} bg-emerald-600 hover:bg-emerald-500`}
        >
          Classify Image
        </button>
        <button
          type="button"
          onClick={onClassifyVideos}
          disabled={!canClassifyVideos}
          className={`${btn} bg-teal-600 hover:bg-teal-500`}
        >
          Classify Video
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
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-300">{progress.message}</p>
        ) : null}
      </div>
    </div>
  );
}

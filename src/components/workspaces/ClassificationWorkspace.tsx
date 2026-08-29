import type { ImageClassificationProgress, ImageFile, VideoFile } from '../../../shared/ipc';
import { ImageClassificationPanel } from '../ImageClassificationPanel';
import { EmptyState, Icon, Panel, SectionHeading, StatCard } from '../ui/ui';

interface ClassificationWorkspaceProps {
  progress: ImageClassificationProgress;
  images: ImageFile[];
  videos: VideoFile[];
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

export function ClassificationWorkspace({
  progress,
  images,
  videos,
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
}: ClassificationWorkspaceProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-5 lg:p-7">
      <SectionHeading
        eyebrow="Organization workspace"
        title="Classify Split"
        description="Review images or sample videos locally, then copy results into safe and flagged folders."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Images" value={progress.imageCount} detail="Top-level files" tone="accent" />
        <StatCard label="Videos" value={progress.videoCount} detail="Sampled frames" />
        <StatCard label="Safe" value={progress.safeImages} detail="Copied to safe output" tone="success" />
        <StatCard label="Flagged" value={progress.flaggedImages} detail="Copied to flagged output" tone={progress.flaggedImages ? 'warning' : 'neutral'} />
      </div>

      <Panel className="p-4 lg:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Source</p>
            <h2 className="mt-1 text-base font-semibold text-white">Choose a media folder</h2>
          </div>
          <span className="rounded-md border border-surface-border bg-surface px-2 py-1 text-[11px] text-slate-500">Local model</span>
        </div>
        <ImageClassificationPanel
          progress={progress}
          imageCount={images.length}
          videoCount={videos.length}
          busy={busy}
          allowPercent={allowPercent}
          canSelectFolder={canSelectFolder}
          canClassifyImages={canClassifyImages}
          canClassifyVideos={canClassifyVideos}
          canCancel={canCancel}
          onSelectFolder={onSelectFolder}
          onClassifyImages={onClassifyImages}
          onClassifyVideos={onClassifyVideos}
          onCancel={onCancel}
          onAllowPercentChange={onAllowPercentChange}
          showThreshold={false}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <MediaList title="Images in source" icon="image" items={images.map((file) => file.name)} busy={busy} empty="No supported images scanned." />
        <MediaList title="Videos in source" icon="video" items={videos.map((file) => file.name)} busy={busy} empty="No supported videos scanned." />
      </div>
    </div>
  );
}

function MediaList({
  title,
  icon,
  items,
  busy,
  empty,
}: {
  title: string;
  icon: 'image' | 'video';
  items: string[];
  busy: boolean;
  empty: string;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={15} className="text-sky-300" />
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <span className="ml-auto font-mono text-xs text-slate-500">{items.length}</span>
      </div>
      {busy ? (
        <p className="mt-4 text-sm text-slate-500" role="status">Scanning folder…</p>
      ) : items.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={icon} title="Nothing scanned" description={empty} />
        </div>
      ) : (
        <div className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
          {items.map((name) => (
            <div key={name} className="truncate rounded border border-surface-border bg-surface px-2.5 py-1.5 font-mono text-xs text-slate-400" title={name}>
              {name}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

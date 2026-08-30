import type { BrandingProgress } from '../../../shared/branding';
import type { ImageClassificationProgress, ProcessingProgress, VideoFile } from '../../../shared/ipc';
import type { ImageEditProgress } from '../../../shared/imageEditing';
import { Badge, Button, Icon, Panel, SectionHeading, StatCard } from '../ui/ui';
import type { AppView } from '../shell/Sidebar';

interface OverviewWorkspaceProps {
  processing: ProcessingProgress;
  classification: ImageClassificationProgress;
  branding: BrandingProgress;
  imageEditing: ImageEditProgress;
  videos: VideoFile[];
  imageCount: number;
  classificationVideoCount: number;
  onNavigate: (view: AppView) => void;
}

export function OverviewWorkspace({
  processing,
  classification,
  branding,
  imageEditing,
  videos,
  imageCount,
  classificationVideoCount,
  onNavigate,
}: OverviewWorkspaceProps) {
  const active =
    processing.status === 'processing'
      ? 'Video frame extraction'
      : classification.status === 'classifying'
        ? 'Media classification'
        : branding.status === 'processing' || branding.status === 'previewing'
          ? 'Video branding'
          : imageEditing.status === 'processing' || imageEditing.status === 'previewing'
            ? 'Image editing'
          : null;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-5 lg:p-7">
      <SectionHeading
        eyebrow="Workspace overview"
        title="Make more from your media"
        description="A focused local toolkit for extracting frames, sorting media, and preparing branded video."
        action={
          <Badge tone={processing.ffmpegAvailable ? 'success' : 'danger'}>
            <Icon name={processing.ffmpegAvailable ? 'check' : 'alert'} size={12} />
            {processing.ffmpegAvailable ? 'System ready' : 'FFmpeg unavailable'}
          </Badge>
        }
      />

      {active ? (
        <Panel className="flex flex-wrap items-center justify-between gap-4 border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-accent/15 p-2 text-sky-300">
              <Icon name="activity" size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{active}</p>
              <p className="mt-0.5 text-xs text-slate-400">Your job is running locally in the background.</p>
            </div>
          </div>
          <Button size="sm" variant="primary" icon="arrow-right" onClick={() => onNavigate('activity')}>
            View activity
          </Button>
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Videos scanned" value={videos.length} detail="Video → Frames" tone="accent" />
        <StatCard label="Images found" value={imageCount} detail="Classify Split" />
        <StatCard label="Classify videos" value={classificationVideoCount} detail="Available to review" />
        <StatCard label="Frames generated" value={processing.imagesGenerated} detail="Current session" tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <WorkflowCard
          icon="frames"
          eyebrow="Extract"
          title="Video → Frames"
          description="Select a folder and create one adaptive, quality-checked frame per video."
          count={videos.length ? `${videos.length} videos ready` : 'No folder selected'}
          onClick={() => onNavigate('frames')}
        />
        <WorkflowCard
          icon="classify"
          eyebrow="Organize"
          title="Classify Split"
          description="Classify top-level images or videos locally into safe and flagged outputs."
          count={imageCount || classificationVideoCount ? `${imageCount + classificationVideoCount} items ready` : 'No media scanned'}
          onClick={() => onNavigate('classify')}
        />
        <WorkflowCard
          icon="logo"
          eyebrow="Brand"
          title="Video Branding"
          description="Add a watermark or subtle moving text, preview it, then render a batch."
          count={branding.totalVideos ? `${branding.totalVideos} videos ready` : 'No folder selected'}
          onClick={() => onNavigate('branding')}
        />
        <WorkflowCard
          icon="image"
          eyebrow="Edit"
          title="Image Editing"
          description="Apply presets, grading, crop, side images, and a watermark to a complete image folder."
          count={imageCount ? `${imageCount} images ready` : 'No folder selected'}
          onClick={() => onNavigate('image-editor')}
        />
      </div>

      <Panel className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Session activity</p>
            <p className="mt-1 text-sm font-medium text-slate-200">Your workspace stays ready for the next task.</p>
          </div>
          <Button size="sm" variant="ghost" icon="activity" onClick={() => onNavigate('activity')}>
            Open activity
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ActivityRow label="Frame extraction" status={processing.status} />
          <ActivityRow label="Classification" status={classification.status} />
          <ActivityRow label="Branding" status={branding.status} />
          <ActivityRow label="Image editing" status={imageEditing.status} />
        </div>
      </Panel>
    </div>
  );
}

function WorkflowCard({
  icon,
  eyebrow,
  title,
  description,
  count,
  onClick,
}: {
  icon: 'frames' | 'classify' | 'logo' | 'image';
  eyebrow: string;
  title: string;
  description: string;
  count: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-surface-border bg-surface-raised/80 p-4 text-left transition-colors hover:border-accent/50 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md border border-surface-border bg-surface p-2 text-sky-300">
          <Icon name={icon} size={18} />
        </div>
        <Icon name="arrow-right" size={16} className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-300" />
      </div>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
      <h2 className="mt-1 text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 min-h-10 text-sm leading-relaxed text-slate-400">{description}</p>
      <p className="mt-4 border-t border-surface-border pt-3 text-xs text-slate-500">{count}</p>
    </button>
  );
}

function ActivityRow({ label, status }: { label: string; status: string }) {
  const active = ['processing', 'classifying', 'previewing'].includes(status);
  const completed = ['completed', 'preview_ready'].includes(status);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-surface-border bg-surface px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-sky-400' : completed ? 'bg-emerald-400' : 'bg-slate-600'}`} />
        <span className="truncate text-xs text-slate-300">{label}</span>
      </div>
      <span className="text-[11px] capitalize text-slate-500">{status.replace('_', ' ')}</span>
    </div>
  );
}

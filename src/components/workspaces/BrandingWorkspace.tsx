import { VideoBrandingPanel } from '../branding/VideoBrandingPanel';
import type { VideoBrandingController } from '../../hooks/useVideoBranding';
import { Panel, SectionHeading, StatCard } from '../ui/ui';
import { WorkflowProgressCard } from '../ui/WorkflowProgressCard';

export function BrandingWorkspace({ branding }: { branding: VideoBrandingController }) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-5 lg:p-7">
      <SectionHeading
        eyebrow="Production workspace"
        title="Video Branding"
        description="Compose a watermark or moving text, render a real preview, then apply the same setup to the folder."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Source videos" value={branding.videos.length} detail={branding.folder ?? 'Select a folder'} tone="accent" />
        <StatCard label="Output" value={branding.outputFolder ? 'Ready' : 'Not set'} detail="Originals stay untouched" tone={branding.outputFolder ? 'success' : 'neutral'} />
        <StatCard label="Last run" value={branding.progress.completedVideos} detail={branding.progress.message ?? 'No batch rendered yet'} />
      </div>

      {branding.error ? (
        <Panel className="flex items-start gap-3 border-rose-500/30 bg-rose-950/20 p-4" role="alert">
          <span className="mt-0.5 text-rose-300">!</span>
          <div>
            <p className="text-sm font-medium text-rose-100">Branding action needs attention</p>
            <p className="mt-1 text-sm leading-relaxed text-rose-200/80">{branding.error}</p>
          </div>
        </Panel>
      ) : null}

      <VideoBrandingPanel branding={branding} />

      <WorkflowProgressCard
        icon="logo"
        title="Branding progress"
        description="Preview or batch encoding status for the selected source"
        status={branding.progress.status}
        statusLabel={brandingStatusLabel(branding.progress.status)}
        progressPercent={branding.progress.progressPercent}
        currentFile={branding.progress.currentFile}
        currentStep={
          branding.progress.jobKind === 'preview'
            ? 'Rendering live preview'
            : branding.progress.jobKind === 'batch'
              ? 'Applying branding'
              : null
        }
        completed={branding.progress.completedVideos}
        total={branding.progress.totalVideos}
        failed={branding.progress.failedVideos}
        active={branding.isBranding}
        elapsedMs={branding.progress.elapsedMs}
        message={branding.progress.message}
      />
    </div>
  );
}

function brandingStatusLabel(status: string): string {
  return status === 'no_videos' ? 'No videos' : status.replace('_', ' ').replace(/^\w/, (value) => value.toUpperCase());
}

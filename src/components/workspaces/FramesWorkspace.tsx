import type { ProcessingProgress, VideoFile } from '../../../shared/ipc';
import { FolderControls } from '../FolderControls';
import { EmptyState, Panel, SectionHeading, StatCard } from '../ui/ui';
import { WorkflowProgressCard } from '../ui/WorkflowProgressCard';

interface FramesWorkspaceProps {
  progress: ProcessingProgress;
  videos: VideoFile[];
  busy: boolean;
  allowPercent: number;
  canStart: boolean;
  canCancel: boolean;
  canSelectFolder: boolean;
  onAllowPercentChange: (value: number) => void;
  onSelectFolder: () => void;
  onStart: () => void;
  onCancel: () => void;
}

export function FramesWorkspace({
  progress,
  videos,
  busy,
  allowPercent,
  canStart,
  canCancel,
  canSelectFolder,
  onAllowPercentChange,
  onSelectFolder,
  onStart,
  onCancel,
}: FramesWorkspaceProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-5 lg:p-7">
      <SectionHeading
        eyebrow="Extraction workspace"
        title="Video → Frames"
        description="Generate one adaptive, quality-checked JPEG frame from every video in a selected folder."
      />

      {!progress.ffmpegAvailable ? (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-100" role="alert">
          <span className="font-semibold text-rose-300">!</span>
          <div>
            <p className="font-medium">FFmpeg is unavailable</p>
            <p className="mt-1 text-rose-200/80">{progress.ffmpegError ?? 'Video processing requires the bundled FFmpeg tools.'}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Source videos" value={progress.totalVideos} detail={progress.selectedFolder ?? 'Select a folder'} tone="accent" />
        <StatCard label="Completed" value={progress.completedVideos} detail="Frames saved" tone="success" />
        <StatCard label="Failed" value={progress.failedVideos} detail="Can review in activity" tone={progress.failedVideos ? 'danger' : 'neutral'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]">
        <Panel className="p-4 lg:p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Source</p>
              <h2 className="mt-1 text-base font-semibold text-white">Choose a video folder</h2>
            </div>
            <span className="rounded-md border border-surface-border bg-surface px-2 py-1 text-[11px] text-slate-500">Direct files only</span>
          </div>
          <FolderControls
            selectedFolder={progress.selectedFolder}
            message={progress.message}
            videoCount={videos.length}
            allowPercent={allowPercent}
            canStart={canStart}
            canCancel={canCancel}
            canSelectFolder={canSelectFolder}
            onAllowPercentChange={onAllowPercentChange}
            onSelectFolder={onSelectFolder}
            onStart={onStart}
            onCancel={onCancel}
            showThreshold={false}
          />
        </Panel>

        <Panel className="p-4 lg:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Input queue</p>
          <h2 className="mt-1 text-base font-semibold text-white">Scanned media</h2>
          {busy ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-400" role="status">
              <span className="h-3 w-3 animate-pulse rounded-full bg-accent" />
              Scanning folder…
            </div>
          ) : videos.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon="video" title="No videos ready" description="Select a folder to scan supported video files." />
            </div>
          ) : (
            <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {videos.map((video, index) => (
                <div key={video.path} className="flex items-center gap-2 rounded-md border border-surface-border bg-surface px-2.5 py-2">
                  <span className="font-mono text-[10px] tabular-nums text-slate-600">{String(index + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300" title={video.path}>{video.name}</span>
                  <span className="text-[10px] uppercase text-slate-600">{video.extension.replace('.', '')}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <WorkflowProgressCard
        icon="frames"
        title="Frame extraction progress"
        description="Adaptive selection, quality checks, and local safety classification"
        status={progress.status}
        statusLabel={frameStatusLabel(progress.status)}
        progressPercent={progress.progressPercent}
        currentFile={progress.currentFile}
        currentStep={frameStepLabel(progress.currentStep)}
        completed={progress.completedVideos}
        total={progress.totalVideos}
        failed={progress.failedVideos}
        active={progress.status === 'processing'}
        elapsedMs={progress.elapsedMs}
        message={progress.message}
      />
    </div>
  );
}

function frameStatusLabel(status: ProcessingProgress['status']): string {
  return status === 'no_videos' ? 'No videos' : status.charAt(0).toUpperCase() + status.slice(1);
}

function frameStepLabel(step: ProcessingProgress['currentStep']): string | null {
  const labels: Record<ProcessingProgress['currentStep'], string | null> = {
    idle: null,
    extracting: 'Extracting frame',
    checking: 'Checking frame',
    retrying: 'Retrying safe frame',
    classifying: 'Classifying frame',
    done: 'Complete',
  };
  return labels[step];
}

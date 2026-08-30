import type { ImageEditingController } from '../../hooks/useImageEditing';
import { Button, Panel, SectionHeading, StatCard } from '../ui/ui';
import { WorkflowProgressCard } from '../ui/WorkflowProgressCard';
import { ImageEditingPanel } from '../imageEditing/ImageEditingPanel';

export function ImageEditingWorkspace({ editor }: { editor: ImageEditingController }) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-5 lg:p-7">
      <SectionHeading
        eyebrow="Creative workspace"
        title="Image Editing"
        description="Apply one organized edit setup to a folder of images while keeping every original file untouched."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Source images"
          value={editor.images.length}
          detail={editor.folder ?? 'Select a folder'}
          tone="accent"
        />
        <StatCard
          label="Output"
          value={editor.outputFolder ? 'Ready' : 'Not set'}
          detail="Written to a separate folder"
          tone={editor.outputFolder ? 'success' : 'neutral'}
        />
        <StatCard
          label="Last run"
          value={editor.progress.completedImages}
          detail={editor.progress.message ?? 'No batch rendered yet'}
        />
      </div>

      {editor.error ? (
        <Panel className="flex items-start gap-3 border-rose-500/30 bg-rose-950/20 p-4" role="alert">
          <span className="mt-0.5 text-rose-300">!</span>
          <div>
            <p className="text-sm font-medium text-rose-100">Image editing needs attention</p>
            <p className="mt-1 text-sm leading-relaxed text-rose-200/80">{editor.error}</p>
          </div>
        </Panel>
      ) : null}

      <Panel className="flex flex-wrap items-center justify-between gap-3 bg-surface/80 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">Image batch</p>
          <p className="mt-1 truncate font-mono text-xs text-slate-400" title={editor.folder ?? undefined}>
            {editor.folder ?? 'No source folder selected'}
          </p>
          {editor.images.length > 0 ? (
            <p className="mt-1 text-xs text-emerald-300">
              {editor.images.length} supported image{editor.images.length === 1 ? '' : 's'} ready
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon="folder"
            disabled={!editor.canSelectFolder}
            onClick={() => {
              void editor.selectFolder();
            }}
          >
            Select Folder
          </Button>
          <Button
            variant="success"
            icon="play"
            disabled={!editor.canApply}
            onClick={() => {
              void editor.applyToAll();
            }}
          >
            Apply to All
          </Button>
          <Button
            variant="secondary"
            icon="refresh"
            disabled={!editor.canPreview || !editor.previewImagePath}
            onClick={() => {
              void editor.generatePreview();
            }}
          >
            Refresh Preview
          </Button>
        </div>
      </Panel>

      <ImageEditingPanel editor={editor} />

      <WorkflowProgressCard
        icon="image"
        title="Image editing progress"
        description="Live status for preview rendering and folder output"
        status={editor.progress.status}
        statusLabel={imageEditStatusLabel(editor.progress.status)}
        progressPercent={editor.progress.progressPercent}
        currentFile={editor.progress.currentFile}
        currentStep={
          editor.progress.jobKind === 'preview'
            ? 'Rendering live preview'
            : editor.progress.jobKind === 'batch'
              ? 'Applying image edits'
              : null
        }
        completed={editor.progress.completedImages}
        total={editor.progress.totalImages}
        failed={editor.progress.failedImages}
        active={editor.isEditing}
        elapsedMs={editor.progress.elapsedMs}
        message={editor.progress.message}
      />
    </div>
  );
}

function imageEditStatusLabel(status: string): string {
  if (status === 'no_images') {
    return 'No images';
  }
  return status.replace('_', ' ').replace(/^\w/, (value) => value.toUpperCase());
}

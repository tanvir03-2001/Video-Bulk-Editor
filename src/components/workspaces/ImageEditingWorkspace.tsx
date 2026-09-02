import type { ImageEditingController } from '../../hooks/useImageEditing';
import { ImageEditPreview } from '../imageEditing/ImageEditPreview';
import { ImageEditingPanel } from '../imageEditing/ImageEditingPanel';
import {
  AlertBanner,
  Badge,
  Button,
  EditorChrome,
  Icon,
  ProgressBar,
  StatCard,
  StatusDot,
  ToolbarRow,
} from '../ui/ui';

export function ImageEditingWorkspace({ editor }: { editor: ImageEditingController }) {
  const active =
    editor.progress.status === 'processing' || editor.progress.status === 'previewing';
  const finished = editor.progress.status === 'completed';

  return (
    <EditorChrome>
      <ToolbarRow className="justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              Creative
            </p>
            <h2 className="truncate text-sm font-semibold text-white">Image Editing</h2>
          </div>
          {editor.images.length > 0 ? (
            <Badge tone="success">
              {editor.images.length} image{editor.images.length === 1 ? '' : 's'}
            </Badge>
          ) : null}
          <Button
            size="sm"
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
            size="sm"
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
            size="sm"
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
        <div className="grid w-full max-w-xl grid-cols-3 gap-2 sm:w-auto">
          <StatCard
            compact
            label="Source"
            value={editor.images.length}
            detail={editor.folder ? 'Folder set' : 'Select folder'}
            tone="accent"
          />
          <StatCard
            compact
            label="Output"
            value={editor.outputFolder ? 'Ready' : 'Default'}
            tone={editor.outputFolder ? 'success' : 'neutral'}
          />
          <StatCard compact label="Done" value={editor.progress.completedImages} />
        </div>
      </ToolbarRow>

      {editor.error ? (
        <div className="shrink-0 px-3 pt-3 lg:px-4">
          <AlertBanner title="Image editing needs attention">{editor.error}</AlertBanner>
        </div>
      ) : null}

      {editor.folder ? (
        <div className="shrink-0 border-b border-surface-border px-3 py-2 lg:px-4">
          <p className="truncate font-mono text-[11px] text-slate-500" title={editor.folder}>
            {editor.folder}
          </p>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto border-b border-surface-border p-3 lg:border-b-0 lg:border-r lg:p-4">
          <ImageEditingPanel editor={editor} />
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden bg-surface/40 p-3 lg:p-4">
          <ImageEditPreview editor={editor} />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-surface-border bg-surface-raised/60 px-3 py-2 lg:px-4">
        <div className="flex items-center gap-2">
          <Icon name="image" size={14} className="text-sky-300" />
          <StatusDot
            tone={
              active
                ? 'active'
                : finished
                  ? 'success'
                  : editor.progress.failedImages > 0
                    ? 'danger'
                    : 'neutral'
            }
          />
          <span className="text-xs font-medium text-slate-300">
            {imageEditStatusLabel(editor.progress.status)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <ProgressBar
            value={editor.progress.progressPercent}
            tone={editor.progress.failedImages > 0 ? 'warning' : finished ? 'success' : 'accent'}
          />
        </div>
        <span className="font-mono text-xs tabular-nums text-slate-400">
          {Math.round(editor.progress.progressPercent)}%
        </span>
        <span className="hidden text-xs text-slate-500 sm:inline">
          {editor.progress.completedImages}/{editor.progress.totalImages || '—'}
        </span>
      </div>
    </EditorChrome>
  );
}

function imageEditStatusLabel(status: string): string {
  if (status === 'no_images') {
    return 'No images';
  }
  return status.replace('_', ' ').replace(/^\w/, (value) => value.toUpperCase());
}

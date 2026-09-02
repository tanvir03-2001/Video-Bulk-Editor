import { useEffect, useState } from 'react';
import type { ImageEditingController } from '../../hooks/useImageEditing';
import { Button, Field, Panel, Select } from '../ui/ui';

export function ImageEditPreview({ editor }: { editor: ImageEditingController }) {
  const [previewError, setPreviewError] = useState(false);
  const previewAspectRatio =
    editor.progress.previewWidth && editor.progress.previewHeight
      ? `${editor.progress.previewWidth} / ${editor.progress.previewHeight}`
      : editor.config.canvas.aspectRatio === 'custom'
        ? `${editor.config.canvas.customWidth} / ${editor.config.canvas.customHeight}`
        : editor.config.canvas.aspectRatio === 'source'
          ? '4 / 3'
          : editor.config.canvas.aspectRatio.replace(':', ' / ');

  const ratioParts = previewAspectRatio.split('/').map((part) => Number(part.trim()));
  const ratioValue =
    ratioParts.length === 2 && ratioParts[0] > 0 && ratioParts[1] > 0
      ? ratioParts[0] / ratioParts[1]
      : 4 / 3;

  useEffect(() => {
    setPreviewError(false);
  }, [editor.previewUrl]);

  return (
    <Panel className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden bg-surface p-3">
      <div className="shrink-0 space-y-2">
        <div>
          <p className="text-xs font-semibold text-slate-200">Live image preview</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            Changes update automatically for the selected image.
          </p>
        </div>

        <Field label="Preview image" htmlFor="image-edit-preview-select">
          <Select
            id="image-edit-preview-select"
            value={editor.previewImagePath ?? ''}
            disabled={editor.images.length === 0 || editor.isEditing || editor.busy}
            onChange={(event) => {
              editor.setPreviewImagePath(event.target.value || null);
            }}
          >
            {editor.images.length === 0 ? <option value="">Select a folder first</option> : null}
            {editor.images.map((image) => (
              <option key={image.path} value={image.path}>
                {image.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden [container-type:size]">
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="relative overflow-hidden rounded-md border border-surface-border bg-surface-raised"
            style={{
              aspectRatio: previewAspectRatio,
              width: `min(100cqw, calc(100cqh * ${ratioValue}))`,
              height: `min(100cqh, calc(100cqw / ${ratioValue}))`,
            }}
          >
            {editor.previewUrl && !previewError ? (
              <img
                src={editor.previewUrl}
                alt="Edited image preview"
                className="absolute inset-0 block h-full w-full object-contain"
                onError={() => {
                  setPreviewError(true);
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-3 text-center text-xs leading-relaxed text-slate-500">
                {previewError
                  ? 'The preview image could not be decoded. Refresh the preview to try again.'
                  : editor.progress.status === 'previewing'
                    ? 'Updating live preview…'
                    : editor.error
                      ? editor.error
                      : editor.configReady
                        ? 'Preview will appear here'
                        : 'Choose an edit setting to start preview'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-2">
        {editor.error ? (
          <p className="text-xs leading-relaxed text-rose-300" role="alert">
            {editor.error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="success"
            icon="play"
            disabled={!editor.canApply}
            onClick={() => {
              void editor.applyToAll();
            }}
            className="w-full"
          >
            Apply to all
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon="stop"
            disabled={!editor.canCancel}
            onClick={() => {
              void editor.cancel();
            }}
            className="w-full"
          >
            Cancel
          </Button>
        </div>

        <div className="border-t border-surface-border pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-slate-500">Output folder</p>
            <button
              type="button"
              className="text-[11px] text-sky-300 hover:text-sky-200"
              onClick={() => {
                void editor.resetOutputFolder();
              }}
              disabled={!editor.folder || editor.busy || editor.isEditing}
            >
              Use default
            </button>
          </div>
          <p
            className="mt-1 truncate font-mono text-[10px] text-slate-400"
            title={editor.outputFolder ?? undefined}
          >
            {editor.outputFolder ?? 'Default Edited Images folder'}
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon="folder"
            disabled={editor.busy || editor.isEditing}
            onClick={() => {
              void editor.selectOutputFolder();
            }}
            className="mt-2 w-full"
          >
            Change output folder
          </Button>
        </div>
      </div>
    </Panel>
  );
}

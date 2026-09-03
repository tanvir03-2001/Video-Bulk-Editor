import { memo } from 'react';
import type { VideoComposerController } from '../../hooks/useVideoComposer';
import { ComposerAssetStrip } from '../composer/ComposerAssetStrip';
import { ResizableEditorSplit } from '../layout/ResizableEditorSplit';
import { ComposerControls } from '../composer/ComposerControls';
import { ComposerPreview } from '../composer/ComposerPreview';
import { TimelineEditor } from '../composer/TimelineEditor';
import {
  AlertBanner,
  Badge,
  Button,
  EditorChrome,
  Field,
  ProgressBar,
  StatusDot,
  TextInput,
  ToolbarRow,
} from '../ui/ui';

interface ComposerWorkspaceProps {
  composer: VideoComposerController;
}

export const ComposerWorkspace = memo(function ComposerWorkspace({
  composer,
}: ComposerWorkspaceProps) {
  const selectedClip = composer.clips.find((clip) => clip.id === composer.selectedClipId) ?? null;
  const videoOnly = composer.composerMode === 'video-only';
  const setupReady = composer.videos.length > 0 && (videoOnly || Boolean(composer.audioPath));
  const active = composer.isWorking;
  const finished = composer.progress.status === 'completed';

  return (
    <EditorChrome>
      <ToolbarRow>
        <Button
          size="sm"
          variant="secondary"
          icon="refresh"
          onClick={() => {
            void composer.createNewProject();
          }}
          disabled={!composer.canCreateNew}
          title="Clear videos, audio, and timeline. Saved settings profiles stay intact."
        >
          New Project
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon="frames"
          onClick={() => {
            void composer.addVideos();
          }}
          disabled={!composer.canAddVideos}
        >
          Add Videos
        </Button>
        {!videoOnly ? (
          <Button
            size="sm"
            variant="secondary"
            icon="play"
            onClick={() => {
              void composer.selectAudio();
            }}
            disabled={!composer.canAddVideos}
          >
            Select Audio
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="success"
          icon="spark"
          onClick={() => {
            void composer.exportVideo();
          }}
          disabled={!composer.canExport}
        >
          Export
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon="stop"
          onClick={() => {
            void composer.cancel();
          }}
          disabled={!composer.canCancel}
        >
          Cancel
        </Button>

        <div className="mx-1 hidden h-5 w-px bg-surface-border sm:block" />

        <Button
          size="sm"
          variant={composer.composerMode === 'video-plus-audio' ? 'primary' : 'ghost'}
          disabled={!composer.canAddVideos}
          onClick={() => {
            composer.changeComposerMode('video-plus-audio');
          }}
        >
          Video + Audio
        </Button>
        <Button
          size="sm"
          variant={videoOnly ? 'primary' : 'ghost'}
          disabled={!composer.canAddVideos}
          onClick={() => {
            composer.changeComposerMode('video-only');
          }}
        >
          Only Video
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {composer.videos.length > 0 ? (
            <Badge tone="success">{composer.videos.length} videos</Badge>
          ) : null}
          {!videoOnly && composer.audioPath ? <Badge tone="accent">Audio ready</Badge> : null}
          <Badge tone={setupReady ? 'success' : 'neutral'}>
            {setupReady ? 'Ready to export' : videoOnly ? 'Add videos' : 'Needs videos + audio'}
          </Badge>
        </div>
      </ToolbarRow>

      {videoOnly ? (
        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-surface-border bg-surface/60 px-3 py-2.5 lg:px-4">
          <div className="rounded-md border border-surface-border bg-surface-raised px-3 py-2 text-xs text-slate-400">
            <p className="text-slate-500">Source duration</p>
            <p className="mt-0.5 font-mono text-sm text-slate-100">
              {composer.naturalVideoDurationSeconds.toFixed(1)}s
            </p>
          </div>
          <Field label="Custom duration (optional)" className="w-40">
            <TextInput
              type="number"
              min={composer.naturalVideoDurationSeconds || 0}
              step={0.5}
              disabled={!composer.canAddVideos}
              value={composer.customDurationSeconds ?? ''}
              placeholder={String(composer.naturalVideoDurationSeconds.toFixed(1))}
              onChange={(event) => {
                const raw = event.target.value;
                if (!raw.trim()) {
                  composer.changeCustomDurationSeconds(null);
                  return;
                }
                const next = Number(raw);
                composer.changeCustomDurationSeconds(
                  Number.isFinite(next) && next > 0 ? next : null,
                );
              }}
            />
          </Field>
          <Button
            size="sm"
            variant="secondary"
            icon="image"
            disabled={!composer.canAddVideos}
            onClick={() => {
              void composer.selectPadImage();
            }}
          >
            {composer.padImagePath ? 'Change pad image' : 'Add pad image'}
          </Button>
          {composer.padImagePath ? (
            <>
              <Badge tone="accent" className="max-w-[160px] truncate">
                {composer.padImagePath.split(/[\\/]/).pop()}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                disabled={!composer.canAddVideos}
                onClick={() => {
                  composer.clearPadImage();
                }}
              >
                Clear
              </Button>
            </>
          ) : (
            <p className="text-[11px] text-slate-500">
              Optional still for extra duration instead of auto-cut fillers.
            </p>
          )}
        </div>
      ) : null}

      {composer.error ? (
        <div className="shrink-0 px-3 pt-2 lg:px-4">
          <AlertBanner title="Combiner needs attention">{composer.error}</AlertBanner>
        </div>
      ) : null}

      <ResizableEditorSplit
        settings={
          <>
            <ComposerControls
              selectedClip={selectedClip}
              branding={composer.branding}
              settingsProfiles={composer.settingsProfiles}
              outputPath={composer.outputPath}
              audioPath={composer.audioPath}
              disabled={!composer.canAddVideos}
              onUpdateClip={composer.updateClip}
              onUpdateWatermark={composer.updateWatermarkWithEnable}
              onUpdateWatermarkText={composer.updateWatermarkText}
              onUpdateMovingText={composer.updateMovingText}
              onUpdateSideImage={composer.updateSideImage}
              onUpdateImagePreset={composer.updateImagePreset}
              onUpdateSubtitles={composer.updateSubtitles}
              onSelectLogoImage={() => {
                void composer.selectLogoImage();
              }}
              onSelectSideImage={(side) => {
                void composer.selectSideImage(side);
              }}
              onSelectOutputPath={() => {
                void composer.selectOutputPath();
              }}
            />
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              {videoOnly
                ? 'Only Video mode combines clips without a soundtrack. Set a custom duration to extend with a pad image or auto-cut fillers.'
                : 'Video + Audio matches the soundtrack length. Short timelines get auto-cut fillers. Default clip volume is 20%.'}
            </p>
          </>
        }
        preview={
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface/30 p-3 lg:p-4">
              <ComposerPreview
                clips={composer.clips}
                proxyPaths={composer.proxyPaths}
                audioPath={composer.audioPath}
                branding={composer.branding}
                exportedPath={composer.exportedOutputPath}
                previewWidth={composer.previewDimensions.width}
                previewHeight={composer.previewDimensions.height}
                durationSeconds={composer.previewDurationSeconds}
                playheadSeconds={composer.playheadSeconds}
                isPlaying={composer.isPreviewPlaying}
                onPlayheadChange={composer.setPlayheadSeconds}
                onPlayingChange={composer.setIsPreviewPlaying}
                label={composer.exportedOutputPath ? 'Exported preview' : 'Live preview'}
              />
            </div>
            <div className="max-h-[42%] shrink-0 space-y-2 overflow-y-auto border-t border-surface-border bg-surface/80 p-2.5 lg:p-3">
              <ComposerAssetStrip
                videos={composer.videos}
                thumbnails={composer.thumbnails}
                disabled={!composer.canAddVideos}
                onRemoveVideo={(videoPath) => {
                  void composer.removeVideo(videoPath);
                }}
              />
              <TimelineEditor
                clips={composer.clips}
                thumbnails={composer.thumbnails}
                targetDurationSeconds={composer.targetDurationSeconds}
                audioDurationSeconds={composer.audioDurationSeconds}
                audioPath={composer.audioPath}
                selectedClipId={composer.selectedClipId}
                playheadSeconds={composer.playheadSeconds}
                isPlaying={composer.isPreviewPlaying}
                pixelsPerSecond={composer.timelineZoom}
                onSelectClip={composer.setSelectedClipId}
                onReorderClip={composer.reorderClip}
                onRemoveClip={(clipId) => {
                  void composer.removeClip(clipId);
                }}
                onPlayheadChange={composer.setPlayheadSeconds}
                onPlayingChange={composer.setIsPreviewPlaying}
                onZoomChange={composer.setTimelineZoom}
              />
            </div>
          </div>
        }
        previewClassName="bg-surface/30 p-0 lg:p-0"
      />

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-surface-border bg-surface-raised/60 px-3 py-2 lg:px-4">
        <StatusDot
          tone={
            active
              ? 'active'
              : composer.progress.status === 'error'
                ? 'danger'
                : finished
                  ? 'success'
                  : 'neutral'
          }
        />
        <span className="text-xs font-medium text-slate-300">
          {composer.activityMessage ?? composer.progress.message ?? 'Idle'}
        </span>
        <div className="min-w-0 flex-1">
          {(active || composer.progress.progressPercent > 0) && (
            <ProgressBar value={composer.progress.progressPercent} />
          )}
        </div>
        <span className="font-mono text-xs tabular-nums text-slate-400">
          {Math.round(composer.progress.progressPercent)}%
        </span>
      </div>
    </EditorChrome>
  );
});

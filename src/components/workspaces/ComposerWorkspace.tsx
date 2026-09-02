import type { VideoComposerController } from '../../hooks/useVideoComposer';
import { ComposerAssetStrip } from '../composer/ComposerAssetStrip';
import { ComposerControls } from '../composer/ComposerControls';
import { TimelineEditor } from '../composer/TimelineEditor';
import { Badge, Button, Panel } from '../ui/ui';

interface ComposerWorkspaceProps {
  composer: VideoComposerController;
}

export function ComposerWorkspace({ composer }: ComposerWorkspaceProps) {
  const selectedClip = composer.clips.find((clip) => clip.id === composer.selectedClipId) ?? null;
  const videoOnly = composer.composerMode === 'video-only';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          icon="refresh"
          onClick={() => {
            void composer.createNewProject();
          }}
          disabled={!composer.canCreateNew}
          title="Clear videos, audio, and timeline. Watermark, side images, and moving text stay saved."
        >
          New Project
        </Button>
        <Button
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
          variant="success"
          icon="spark"
          onClick={() => {
            void composer.exportVideo();
          }}
          disabled={!composer.canExport}
        >
          Export Combined Video
        </Button>
        <Button
          variant="danger"
          icon="stop"
          onClick={() => {
            void composer.cancel();
          }}
          disabled={!composer.canCancel}
        >
          Cancel
        </Button>
        {composer.videos.length > 0 ? (
          <Badge tone="success">{composer.videos.length} videos</Badge>
        ) : null}
        {!videoOnly && composer.audioPath ? <Badge tone="accent">Audio ready</Badge> : null}
      </div>

      <Panel className="space-y-3 bg-surface p-3.5">
        <p className="text-xs font-medium text-slate-300">Combine mode</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={composer.composerMode === 'video-plus-audio' ? 'primary' : 'secondary'}
            disabled={!composer.canAddVideos}
            onClick={() => {
              composer.changeComposerMode('video-plus-audio');
            }}
          >
            Video + Audio
          </Button>
          <Button
            size="sm"
            variant={videoOnly ? 'primary' : 'secondary'}
            disabled={!composer.canAddVideos}
            onClick={() => {
              composer.changeComposerMode('video-only');
            }}
          >
            Only Video
          </Button>
        </div>

        {videoOnly ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-surface-border bg-surface-raised px-3 py-2 text-xs text-slate-400">
              <p className="text-slate-500">Total source duration</p>
              <p className="mt-1 font-mono text-sm text-slate-100">
                {composer.naturalVideoDurationSeconds.toFixed(1)}s
              </p>
            </div>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Custom duration (seconds, optional)</span>
              <input
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
                className="w-full rounded-md border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-accent disabled:opacity-40"
              />
            </label>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
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
                  <Badge tone="accent" className="max-w-full truncate">
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
                  Optional. If set, extra duration uses this still instead of auto-cut fillers.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </Panel>

      {composer.error ? (
        <Panel className="border-rose-500/30 bg-rose-950/20 px-3 py-2 text-sm text-rose-100" role="alert">
          {composer.error}
        </Panel>
      ) : null}

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

      <ComposerControls
        selectedClip={selectedClip}
        branding={composer.branding}
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

      <p className="text-xs leading-relaxed text-slate-500">
        {videoOnly
          ? 'Only Video mode combines your clips without a soundtrack. Set a custom duration to extend the timeline with a pad image or auto-cut fillers.'
          : 'Video + Audio matches the soundtrack length (starting 1 second after video begins). Short timelines get auto-cut fillers with transitions. Default clip volume is 20%.'}
      </p>
    </div>
  );
}

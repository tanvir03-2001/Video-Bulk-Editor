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
        {composer.audioPath ? <Badge tone="accent">Audio ready</Badge> : null}
      </div>

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
        Videos are combined to match the audio length (starting 1 second after video begins). If
        clips are too short, a freeze-frame filler is added automatically. Default clip volume is
        20%.
      </p>
    </div>
  );
}

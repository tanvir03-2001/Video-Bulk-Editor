import { useEffect, useState } from 'react';
import { AppShell } from './components/shell/AppShell';
import { InspectorPanel } from './components/shell/InspectorPanel';
import { Sidebar, type AppView } from './components/shell/Sidebar';
import { StatusBar } from './components/shell/StatusBar';
import { TopToolbar } from './components/shell/TopToolbar';
import { useImageClassification } from './hooks/useImageClassification';
import { useImageEditing } from './hooks/useImageEditing';
import { useProcessing } from './hooks/useProcessing';
import { useVideoBranding } from './hooks/useVideoBranding';
import { useVideoComposer } from './hooks/useVideoComposer';
import { ActivityWorkspace } from './components/workspaces/ActivityWorkspace';
import { BrandingWorkspace } from './components/workspaces/BrandingWorkspace';
import { ComposerWorkspace } from './components/workspaces/ComposerWorkspace';
import { ClassificationWorkspace } from './components/workspaces/ClassificationWorkspace';
import { FramesWorkspace } from './components/workspaces/FramesWorkspace';
import { OverviewWorkspace } from './components/workspaces/OverviewWorkspace';
import { ImageEditingWorkspace } from './components/workspaces/ImageEditingWorkspace';
import type { ProcessingStatus } from './types/processing';
import { formatEstimatedRemaining } from './utils/progress';

type JobFocus = 'video' | 'classify' | 'branding' | 'composer' | 'image-editor';

function videoStatusLabel(status: ProcessingStatus, step: string): string {
  if (status === 'processing') {
    if (step === 'classifying') {
      return 'Classifying images';
    }
    if (step === 'checking') {
      return 'Checking frame';
    }
    if (step === 'retrying') {
      return 'Retrying safe frame';
    }
    if (step === 'extracting') {
      return 'Extracting frames';
    }
    return 'Processing';
  }
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'ready':
      return 'Ready';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'no_videos':
      return 'No Videos';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

function classifyStatusLabel(status: string, videoCount: number): string {
  if (status === 'classifying') {
    return videoCount > 0 ? 'Classifying videos' : 'Classifying images';
  }
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'ready':
      return 'Ready';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'no_images':
      return 'No Media';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

function brandingStatusLabel(status: string): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'ready':
      return 'Ready';
    case 'no_videos':
      return 'No Videos';
    case 'previewing':
      return 'Rendering preview';
    case 'preview_ready':
      return 'Preview ready';
    case 'processing':
      return 'Branding videos';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

function imageEditStatusLabel(status: string): string {
  if (status === 'no_images') {
    return 'No Images';
  }
  return status.replace('_', ' ').replace(/^\w/, (value) => value.toUpperCase());
}

function stepBanner(step: string, isActive: boolean, classifyingVideos: boolean): string | null {
  if (!isActive) {
    return null;
  }
  if (step === 'extracting') {
    return 'Extracting';
  }
  if (step === 'checking') {
    return 'Checking frame';
  }
  if (step === 'retrying') {
    return 'Retrying safe frame';
  }
  if (step === 'classifying') {
    return classifyingVideos ? 'Classifying videos' : 'Classifying images';
  }
  return null;
}

export default function App() {
  const {
    progress,
    videos,
    busy,
    allowPercent,
    setAllowPercent,
    isProcessing,
    canStart,
    canCancel,
    selectFolder,
    startProcessing,
    cancelProcessing,
  } = useProcessing();

  const imageClassification = useImageClassification(isProcessing);
  const classifyActive = imageClassification.isClassifying;
  const branding = useVideoBranding(isProcessing || classifyActive);
  const brandingActive = branding.isBranding;
  const composer = useVideoComposer(isProcessing || classifyActive || brandingActive);
  const composerActive = composer.isWorking;
  const imageEditing = useImageEditing(
    isProcessing || classifyActive || brandingActive || composerActive,
  );
  const imageEditingActive = imageEditing.isEditing;
  const jobActive =
    isProcessing || classifyActive || brandingActive || composerActive || imageEditingActive;
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [jobFocus, setJobFocus] = useState<JobFocus>('video');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const stored = window.localStorage.getItem('frame-studio-theme');
      return stored === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('frame-studio-theme', theme);
    } catch {
      // Theme preference is optional and should never interrupt processing.
    }
  }, [theme]);

  useEffect(() => {
    if (isProcessing) {
      setJobFocus('video');
    }
  }, [isProcessing]);

  useEffect(() => {
    if (classifyActive) {
      setJobFocus('classify');
    }
  }, [classifyActive]);

  useEffect(() => {
    if (brandingActive) {
      setJobFocus('branding');
    }
  }, [brandingActive]);

  useEffect(() => {
    if (imageEditingActive) {
      setJobFocus('image-editor');
    }
  }, [imageEditingActive]);

  useEffect(() => {
    if (composerActive) {
      setJobFocus('composer');
    }
  }, [composerActive]);

  const showBranding =
    brandingActive || (!isProcessing && !classifyActive && jobFocus === 'branding');
  const showClassify =
    !showBranding && (classifyActive || (!isProcessing && jobFocus === 'classify'));
  const showImageEditing =
    !showBranding &&
    !showClassify &&
    (imageEditingActive ||
      (!isProcessing &&
        !classifyActive &&
        !brandingActive &&
        jobFocus === 'image-editor'));
  const showComposer =
    !showBranding &&
    !showClassify &&
    !showImageEditing &&
    (composerActive ||
      (!isProcessing && !classifyActive && !brandingActive && jobFocus === 'composer'));
  const brandingProgress = branding.progress;
  const composerProgress = composer.progress;
  const classifyProgress = imageClassification.progress;
  const imageEditProgress = imageEditing.progress;
  const classifyingVideos = showClassify && classifyProgress.videoCount > 0;
  const activeStep = showClassify ? classifyProgress.currentStep : progress.currentStep;
  const displayPercent = showBranding
    ? brandingProgress.progressPercent
    : showClassify
      ? classifyProgress.progressPercent
      : showImageEditing
        ? imageEditProgress.progressPercent
        : showComposer
          ? composerProgress.progressPercent
          : progress.progressPercent;
  const displayImageIndex = showBranding
    ? brandingProgress.currentVideoIndex
    : showClassify
      ? classifyProgress.currentImageIndex
      : showImageEditing
        ? imageEditProgress.currentImageIndex
        : progress.currentImageIndex;
  const displayImageTotal = showBranding
    ? brandingProgress.totalVideos
    : showClassify
      ? classifyProgress.currentImageTotal
      : showImageEditing
        ? imageEditProgress.totalImages
        : progress.currentImageTotal;
  const displayCurrentFile = showBranding
    ? brandingProgress.currentFile
    : showClassify
      ? classifyProgress.currentFile
      : showImageEditing
        ? imageEditProgress.currentFile
        : showComposer
          ? composerProgress.currentFile
          : progress.currentFile;
  const displayElapsed = showBranding
    ? brandingProgress.elapsedMs
    : showClassify
      ? classifyProgress.elapsedMs
      : showImageEditing
        ? imageEditProgress.elapsedMs
        : showComposer
          ? composerProgress.elapsedMs
          : progress.elapsedMs;
  const displayMessage = showBranding
    ? brandingProgress.message
    : showClassify
      ? classifyProgress.message
      : showImageEditing
        ? imageEditProgress.message
        : showComposer
          ? composerProgress.message
          : progress.message;
  const displayLogs = showBranding
    ? brandingProgress.logs
    : showClassify
      ? classifyProgress.logs
      : showImageEditing
        ? imageEditProgress.logs
        : showComposer
          ? composerProgress.logs
          : progress.logs;
  const displayStatusLabel = showBranding
    ? brandingStatusLabel(brandingProgress.status)
    : showClassify
      ? classifyStatusLabel(classifyProgress.status, classifyProgress.videoCount)
      : showImageEditing
        ? imageEditStatusLabel(imageEditProgress.status)
        : showComposer
          ? composerStatusLabel(composerProgress.status)
          : videoStatusLabel(progress.status, activeStep);
  const statsCards = showBranding
    ? [
        { label: 'Videos', value: brandingProgress.totalVideos },
        { label: 'Done', value: brandingProgress.completedVideos },
        { label: 'Failed', value: brandingProgress.failedVideos },
        { label: 'Clip %', value: Math.round(brandingProgress.currentVideoPercent) },
        { label: 'Encoder', value: brandingProgress.encoder ?? '—' },
      ]
    : showClassify
      ? [
          {
            label: classifyingVideos ? 'Videos' : 'Images',
            value: classifyingVideos ? classifyProgress.videoCount : classifyProgress.imageCount,
          },
          { label: 'Done', value: classifyProgress.processedCount },
          { label: 'Safe', value: classifyProgress.safeImages },
          { label: 'Flagged', value: classifyProgress.flaggedImages },
          { label: 'Failed', value: classifyProgress.classificationFailed },
        ]
      : showImageEditing
        ? [
            { label: 'Images', value: imageEditProgress.totalImages },
            { label: 'Done', value: imageEditProgress.completedImages },
            { label: 'Failed', value: imageEditProgress.failedImages },
            { label: 'Edit %', value: Math.round(imageEditProgress.progressPercent) },
            { label: 'Format', value: imageEditing.config.outputFormat.toUpperCase() },
          ]
        : showComposer
          ? [
              { label: 'Clips', value: composer.clips.length },
              { label: 'Step', value: composerProgress.stepIndex || 0 },
              { label: 'Total', value: composerProgress.stepTotal },
              { label: 'Encode %', value: Math.round(composerProgress.progressPercent) },
              { label: 'Encoder', value: composerProgress.encoder ?? '1080p HD' },
            ]
          : [
            { label: 'Videos', value: progress.totalVideos },
            { label: 'Done', value: progress.completedVideos },
            { label: 'Left', value: progress.remainingVideos },
            { label: 'Failed', value: progress.failedVideos },
            { label: 'Images', value: progress.imagesGenerated },
          ];
  const activityLabel =
    classifyingVideos ? 'Video' : activeStep === 'classifying' ? 'Image' : 'Video';
  const completedVisible =
    progress.status === 'completed' ||
    progress.status === 'cancelled' ||
    classifyProgress.status === 'completed' ||
    classifyProgress.status === 'cancelled' ||
    classifyProgress.status === 'error' ||
    imageEditProgress.status === 'completed' ||
    imageEditProgress.status === 'cancelled' ||
    imageEditProgress.status === 'error';
  const showTiming =
    jobActive ||
    completedVisible ||
    brandingProgress.status === 'completed' ||
    brandingProgress.status === 'cancelled' ||
    imageEditProgress.status === 'completed' ||
    imageEditProgress.status === 'cancelled';
  const canStartVideo =
    canStart && !classifyActive && !brandingActive && !composerActive && !imageEditingActive;
  const canSelectVideoFolder =
    !busy &&
    !canCancel &&
    !classifyActive &&
    !isProcessing &&
    !brandingActive &&
    !composerActive &&
    !imageEditingActive;
  const canCancelActive = isProcessing || classifyActive;

  const toolbarAction =
    activeView === 'frames'
      ? {
          label: 'Select Folder',
          icon: 'folder' as const,
          onClick: () => void selectFolder(),
          disabled: !canSelectVideoFolder,
        }
      : activeView === 'classify'
        ? {
            label: 'Select Folder',
            icon: 'folder' as const,
            onClick: () => void imageClassification.selectImageFolder(),
            disabled: !imageClassification.canSelectFolder || brandingActive || imageEditingActive,
          }
        : activeView === 'branding'
          ? {
              label: 'Select Folder',
              icon: 'folder' as const,
              onClick: () => void branding.selectFolder(),
              disabled: !branding.canSelectFolder || imageEditingActive,
            }
          : activeView === 'image-editor'
            ? {
                label: 'Select Folder',
                icon: 'folder' as const,
                onClick: () => void imageEditing.selectFolder(),
                disabled: !imageEditing.canSelectFolder,
              }
            : activeView === 'composer'
              ? {
                  label: 'New Project',
                  icon: 'refresh' as const,
                  onClick: () => {
                    void composer.createNewProject();
                  },
                  disabled: !composer.canCreateNew,
                }
              : undefined;

  const renderWorkspace = () => {
    switch (activeView) {
      case 'frames':
        return (
          <FramesWorkspace
            progress={progress}
            videos={videos}
            busy={busy}
            allowPercent={allowPercent}
            canStart={canStartVideo}
            canCancel={canCancelActive}
            canSelectFolder={canSelectVideoFolder}
            onAllowPercentChange={setAllowPercent}
            onSelectFolder={() => void selectFolder()}
            onStart={() => void startProcessing()}
            onCancel={() => {
              if (classifyActive) {
                void imageClassification.cancelClassification();
              } else {
                void cancelProcessing();
              }
            }}
          />
        );
      case 'classify':
        return (
          <ClassificationWorkspace
            progress={classifyProgress}
            images={imageClassification.images}
            videos={imageClassification.videos}
            busy={imageClassification.busy}
            allowPercent={imageClassification.allowPercent}
            canSelectFolder={
              imageClassification.canSelectFolder && !brandingActive && !imageEditingActive
            }
            canClassifyImages={
              imageClassification.canClassifyImages && !brandingActive && !imageEditingActive
            }
            canClassifyVideos={
              imageClassification.canClassifyVideos && !brandingActive && !imageEditingActive
            }
            canCancel={imageClassification.canCancel}
            onSelectFolder={() => void imageClassification.selectImageFolder()}
            onClassifyImages={() => void imageClassification.startClassifyImages()}
            onClassifyVideos={() => void imageClassification.startClassifyVideos()}
            onCancel={() => void imageClassification.cancelClassification()}
            onAllowPercentChange={imageClassification.setAllowPercent}
          />
        );
      case 'branding':
        return <BrandingWorkspace branding={branding} />;
      case 'composer':
        return <ComposerWorkspace composer={composer} />;
      case 'image-editor':
        return <ImageEditingWorkspace editor={imageEditing} />;
      case 'activity':
        return (
          <ActivityWorkspace
            title={
              showBranding
                ? 'Branding activity'
                : showClassify
                  ? 'Classification activity'
                  : showImageEditing
                    ? 'Image editing activity'
                    : 'Processing activity'
            }
            subtitle="Follow the active job, inspect the current file, and review its event log."
            statsCards={statsCards}
            progressPercent={displayPercent}
            currentImageIndex={displayImageIndex}
            currentImageTotal={displayImageTotal}
            isProcessing={jobActive}
            activityLabel={showBranding ? 'Video' : showImageEditing ? 'Image' : activityLabel}
            estimatedRemaining={formatEstimatedRemaining(displayElapsed, displayPercent, jobActive)}
            stepLabel={
              showBranding
                ? brandingActive
                  ? brandingProgress.jobKind === 'preview'
                    ? 'Rendering preview'
                    : 'Branding videos'
                  : null
                : showImageEditing
                  ? imageEditingActive
                    ? imageEditProgress.jobKind === 'preview'
                      ? 'Rendering live preview'
                      : 'Editing images'
                    : null
                  : stepBanner(activeStep, jobActive, classifyingVideos)
            }
            statusLabel={displayStatusLabel}
            currentFile={displayCurrentFile}
            elapsedMs={displayElapsed}
            message={displayMessage}
            showTiming={showTiming}
            logs={displayLogs}
          />
        );
      default:
        return (
          <OverviewWorkspace
            processing={progress}
            classification={classifyProgress}
            branding={brandingProgress}
            imageEditing={imageEditProgress}
            videos={videos}
            imageCount={imageClassification.images.length}
            classificationVideoCount={imageClassification.videos.length}
            onNavigate={setActiveView}
          />
        );
    }
  };

  const layoutMode =
    activeView === 'branding' || activeView === 'composer' || activeView === 'image-editor'
      ? 'editor'
      : 'hub';

  return (
    <AppShell
      theme={theme}
      layoutMode={layoutMode}
      sidebar={
        <Sidebar
          activeView={activeView}
          onNavigate={setActiveView}
          jobActive={jobActive}
          activeJobLabel={displayStatusLabel}
          frameCount={videos.length}
          mediaCount={imageClassification.images.length + imageClassification.videos.length}
        />
      }
      toolbar={
        <TopToolbar
          view={activeView}
          jobActive={jobActive}
          statusLabel={displayStatusLabel}
          theme={theme}
          primaryAction={toolbarAction}
          secondaryAction={toolbarAction}
          onActivity={() => setActiveView('activity')}
          onToggleTheme={() => {
            setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
          }}
        />
      }
      inspector={
        <InspectorPanel
          view={activeView}
          processing={progress}
          classification={classifyProgress}
          branding={brandingProgress}
          imageEditing={imageEditProgress}
          imageEditingConfig={imageEditing.config}
          brandingConfig={branding.config}
          videoAllowPercent={allowPercent}
          classifyAllowPercent={imageClassification.allowPercent}
          onVideoAllowPercentChange={setAllowPercent}
          onClassifyAllowPercentChange={imageClassification.setAllowPercent}
          composerProgress={composer.progress}
          composerActivityMessage={composer.activityMessage}
          composerActivityLogs={composer.activityLogs}
          composerIsWorking={composer.isWorking}
          composerVideoCount={composer.videos.length}
          composerAudioReady={Boolean(composer.audioPath)}
          composerVideoOnly={composer.composerMode === 'video-only'}
          composerOutputPath={composer.outputPath}
          composerBrandingConfig={composer.branding}
        />
      }
      statusBar={
        <StatusBar
          jobActive={jobActive}
          statusLabel={displayStatusLabel}
          message={displayMessage}
          currentFile={displayCurrentFile}
          progressPercent={displayPercent}
          completed={
            showBranding
              ? brandingProgress.completedVideos
              : showClassify
                ? classifyProgress.processedCount
                : showImageEditing
                  ? imageEditProgress.completedImages
                  : progress.completedVideos
          }
          total={
            showBranding
              ? brandingProgress.totalVideos
              : showClassify
                ? classifyProgress.currentImageTotal || classifyProgress.imageCount || classifyProgress.videoCount
                : showImageEditing
                  ? imageEditProgress.totalImages
                  : progress.totalVideos
          }
          failed={
            showBranding
              ? brandingProgress.failedVideos
              : showClassify
                ? classifyProgress.classificationFailed
                : showImageEditing
                  ? imageEditProgress.failedImages
                  : progress.failedVideos
          }
          elapsed={formatElapsed(displayElapsed)}
        />
      }
    >
      {renderWorkspace()}
    </AppShell>
  );
}

function composerStatusLabel(status: string): string {
  switch (status) {
    case 'importing':
      return 'Importing media';
    case 'analyzing':
      return 'Planning timeline';
    case 'exporting':
      return 'Exporting video';
    case 'completed':
      return 'Export complete';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
      return 'Export failed';
    case 'ready':
      return 'Ready';
    default:
      return status.replace('_', ' ').replace(/^\w/, (value) => value.toUpperCase());
  }
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

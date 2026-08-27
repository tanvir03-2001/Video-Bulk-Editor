import { useEffect, useState } from 'react';
import { FolderControls } from './components/FolderControls';
import { ImageClassificationPanel } from './components/ImageClassificationPanel';
import { LogPanel } from './components/LogPanel';
import { ProgressPanel } from './components/ProgressPanel';
import { StatsGrid } from './components/StatsGrid';
import { StatusPanel } from './components/StatusPanel';
import { VideoBrandingPanel } from './components/branding/VideoBrandingPanel';
import { useImageClassification } from './hooks/useImageClassification';
import { useProcessing } from './hooks/useProcessing';
import { useVideoBranding } from './hooks/useVideoBranding';
import type { ProcessingStatus } from './types/processing';
import { APP_DISPLAY_NAME } from '../shared/appMeta';

type JobFocus = 'video' | 'classify' | 'branding';

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
  const videoActive = isProcessing;
  const branding = useVideoBranding(videoActive || classifyActive);
  const brandingActive = branding.isBranding;
  const jobActive = videoActive || classifyActive || brandingActive;

  const [jobFocus, setJobFocus] = useState<JobFocus>('video');

  useEffect(() => {
    if (videoActive) {
      setJobFocus('video');
    }
  }, [videoActive]);

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

  const showBranding =
    brandingActive || (!videoActive && !classifyActive && jobFocus === 'branding');
  const showClassify = !showBranding && (classifyActive || (!videoActive && jobFocus === 'classify'));
  const brandingProgress = branding.progress;
  const classifyProgress = imageClassification.progress;
  const classifyingVideos = showClassify && classifyProgress.videoCount > 0;
  const activeStep = showClassify ? classifyProgress.currentStep : progress.currentStep;

  const displayPercent = showBranding
    ? brandingProgress.progressPercent
    : showClassify
      ? classifyProgress.progressPercent
      : progress.progressPercent;
  const displayImageIndex = showBranding
    ? brandingProgress.currentVideoIndex
    : showClassify
      ? classifyProgress.currentImageIndex
      : progress.currentImageIndex;
  const displayImageTotal = showBranding
    ? brandingProgress.totalVideos
    : showClassify
      ? classifyProgress.currentImageTotal
      : progress.currentImageTotal;
  const displayCurrentFile = showBranding
    ? brandingProgress.currentFile
    : showClassify
      ? classifyProgress.currentFile
      : progress.currentFile;
  const displayElapsed = showBranding
    ? brandingProgress.elapsedMs
    : showClassify
      ? classifyProgress.elapsedMs
      : progress.elapsedMs;
  const displayMessage = showBranding
    ? brandingProgress.message
    : showClassify
      ? classifyProgress.message
      : progress.message;
  const displayLogs = showBranding
    ? brandingProgress.logs
    : showClassify
      ? classifyProgress.logs
      : progress.logs;

  const displayStatusLabel = showBranding
    ? brandingStatusLabel(brandingProgress.status)
    : showClassify
      ? classifyStatusLabel(classifyProgress.status, classifyProgress.videoCount)
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
      : [
          { label: 'Videos', value: progress.totalVideos },
          { label: 'Done', value: progress.completedVideos },
          { label: 'Left', value: progress.remainingVideos },
          { label: 'Failed', value: progress.failedVideos },
          { label: 'Images', value: progress.imagesGenerated },
        ];

  const activityLabel = classifyingVideos
    ? 'Video'
    : activeStep === 'classifying'
      ? 'Image'
      : 'Video';

  const completedVisible =
    progress.status === 'completed' ||
    progress.status === 'cancelled' ||
    classifyProgress.status === 'completed' ||
    classifyProgress.status === 'cancelled' ||
    classifyProgress.status === 'error';

  const showTiming =
    jobActive ||
    completedVisible ||
    brandingProgress.status === 'completed' ||
    brandingProgress.status === 'cancelled';
  const canStartVideo = canStart && !classifyActive && !brandingActive;
  const canSelectVideoFolder =
    !busy && !canCancel && !classifyActive && !isProcessing && !brandingActive;
  const canCancelActive = videoActive || classifyActive;

  return (
    <div className="flex h-full min-h-full flex-col bg-surface font-sans text-slate-100 antialiased">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-1 flex-col gap-3.5 px-5 py-4">
        <header className="flex shrink-0 items-baseline justify-between gap-3 border-b border-surface-border pb-3">
          <h1 className="text-xl font-semibold tracking-readable text-white">
            {APP_DISPLAY_NAME}
          </h1>
          <p className="hidden text-sm leading-relaxed text-slate-400 sm:block">
            Frames · Classify image/video · Progress stays until next job
          </p>
        </header>

        {!progress.ffmpegAvailable ? (
          <div className="shrink-0 rounded-md border border-rose-700/50 bg-rose-950/30 px-3 py-2 text-sm leading-relaxed text-rose-100">
            {progress.ffmpegError ?? 'FFmpeg is required for video processing.'}
          </div>
        ) : null}

        <div className="grid shrink-0 gap-3 md:grid-cols-2">
          <section className="rounded-md border border-surface-border bg-surface-raised/70 p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-readable text-slate-100">
                1. Video → Frames
              </h2>
              <span className="text-xs text-slate-400">Generated Images + inline safe/flagged</span>
            </div>
            <FolderControls
              selectedFolder={
                showClassify && classifyActive
                  ? classifyProgress.selectedFolder
                  : progress.selectedFolder
              }
              message={showClassify && classifyActive ? null : progress.message}
              videoCount={videos.length}
              allowPercent={allowPercent}
              canStart={canStartVideo}
              canCancel={canCancelActive}
              canSelectFolder={canSelectVideoFolder}
              onAllowPercentChange={setAllowPercent}
              onSelectFolder={() => {
                if (!canSelectVideoFolder) {
                  return;
                }
                void selectFolder();
              }}
              onStart={() => {
                void startProcessing();
              }}
              onCancel={() => {
                if (classifyActive) {
                  void imageClassification.cancelClassification();
                  return;
                }
                void cancelProcessing();
              }}
            />
          </section>

          <section className="rounded-md border border-surface-border bg-surface-raised/70 p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-readable text-slate-100">
                2. Classify Split
              </h2>
              <span className="text-xs text-slate-400">safe / flagged folders</span>
            </div>
            <ImageClassificationPanel
              progress={imageClassification.progress}
              imageCount={imageClassification.images.length}
              videoCount={imageClassification.videos.length}
              busy={imageClassification.busy}
              allowPercent={imageClassification.allowPercent}
              canSelectFolder={imageClassification.canSelectFolder && !brandingActive}
              canClassifyImages={imageClassification.canClassifyImages && !brandingActive}
              canClassifyVideos={imageClassification.canClassifyVideos && !brandingActive}
              canCancel={imageClassification.canCancel}
              onSelectFolder={() => {
                void imageClassification.selectImageFolder();
              }}
              onClassifyImages={() => {
                void imageClassification.startClassifyImages();
              }}
              onClassifyVideos={() => {
                void imageClassification.startClassifyVideos();
              }}
              onCancel={() => {
                void imageClassification.cancelClassification();
              }}
              onAllowPercentChange={imageClassification.setAllowPercent}
            />
          </section>
        </div>

        <section className="shrink-0 rounded-md border border-surface-border bg-surface-raised/70 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-readable text-slate-100">
              3. Video Branding
            </h2>
            <span className="text-xs text-slate-400">watermark + moving text · originals kept</span>
          </div>
          <VideoBrandingPanel branding={branding} />
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-3 rounded-md border border-surface-border bg-surface-raised/50 p-3.5">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="text-sm font-semibold tracking-readable text-slate-100">Live Progress</h2>
            <span className="text-xs text-slate-400">
              {showBranding
                ? 'Branding job'
                : showClassify
                  ? 'Classification job'
                  : 'Adaptive frame selection'}
            </span>
          </div>

          <StatsGrid cards={statsCards} />

          <ProgressPanel
            progressPercent={displayPercent}
            currentImageIndex={displayImageIndex}
            currentImageTotal={displayImageTotal}
            isProcessing={jobActive}
            activityLabel={showBranding ? 'Video' : activityLabel}
            stepLabel={
              showBranding
                ? brandingActive
                  ? brandingProgress.jobKind === 'preview'
                    ? 'Rendering preview'
                    : 'Branding videos'
                  : null
                : stepBanner(activeStep, jobActive, classifyingVideos)
            }
          />

          <StatusPanel
            statusLabel={displayStatusLabel}
            currentFile={displayCurrentFile}
            elapsedMs={displayElapsed}
            message={displayMessage}
            showTiming={showTiming}
            isActive={jobActive}
          />

          <LogPanel
            logs={displayLogs}
            title={showBranding ? 'Branding log' : showClassify ? 'Classification log' : 'Processing log'}
            compact
          />
        </section>
      </div>
    </div>
  );
}

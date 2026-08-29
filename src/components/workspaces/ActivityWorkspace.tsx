import { LogPanel } from '../LogPanel';
import { ProgressPanel } from '../ProgressPanel';
import { StatsGrid } from '../StatsGrid';
import { StatusPanel } from '../StatusPanel';
import { Panel, SectionHeading } from '../ui/ui';

interface ActivityWorkspaceProps {
  title: string;
  subtitle: string;
  statsCards: Array<{ label: string; value: string | number }>;
  progressPercent: number;
  currentImageIndex: number;
  currentImageTotal: number;
  isProcessing: boolean;
  activityLabel: string;
  stepLabel: string | null;
  statusLabel: string;
  currentFile: string | null;
  elapsedMs: number;
  message: string | null;
  showTiming: boolean;
  logs: Parameters<typeof LogPanel>[0]['logs'];
}

export function ActivityWorkspace({
  title,
  subtitle,
  statsCards,
  progressPercent,
  currentImageIndex,
  currentImageTotal,
  isProcessing,
  activityLabel,
  stepLabel,
  statusLabel,
  currentFile,
  elapsedMs,
  message,
  showTiming,
  logs,
}: ActivityWorkspaceProps) {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col gap-5 p-5 lg:p-7">
      <SectionHeading eyebrow="Monitor" title={title} description={subtitle} />
      <Panel className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:p-5">
        <StatsGrid cards={statsCards} />
        <ProgressPanel
          progressPercent={progressPercent}
          currentImageIndex={currentImageIndex}
          currentImageTotal={currentImageTotal}
          isProcessing={isProcessing}
          activityLabel={activityLabel}
          stepLabel={stepLabel}
        />
        <StatusPanel
          statusLabel={statusLabel}
          currentFile={currentFile}
          elapsedMs={elapsedMs}
          message={message}
          showTiming={showTiming}
          isActive={isProcessing}
        />
        <LogPanel logs={logs} title={`${title} log`} compact={false} />
      </Panel>
    </div>
  );
}

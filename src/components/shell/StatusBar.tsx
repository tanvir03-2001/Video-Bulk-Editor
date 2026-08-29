import { Badge, Icon, ProgressBar, StatusDot } from '../ui/ui';
import { cx } from '../ui/cx';

interface StatusBarProps {
  jobActive: boolean;
  statusLabel: string;
  message: string | null;
  currentFile: string | null;
  progressPercent: number;
  completed: number;
  total: number;
  failed: number;
  elapsed: string;
}

export function StatusBar({
  jobActive,
  statusLabel,
  message,
  currentFile,
  progressPercent,
  completed,
  total,
  failed,
  elapsed,
}: StatusBarProps) {
  return (
    <div className="flex min-h-9 items-center gap-3 border-t border-surface-border bg-surface-raised/70 px-3 text-[11px] text-slate-400 lg:px-4">
      <div className="flex shrink-0 items-center gap-2">
        <StatusDot tone={jobActive ? 'active' : failed > 0 ? 'danger' : 'success'} />
        <span className="font-medium text-slate-300">{statusLabel}</span>
      </div>
      <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
        {currentFile ? (
          <>
            <span className="text-slate-600">/</span>
            <span className="truncate font-mono text-slate-500" title={currentFile}>
              {currentFile}
            </span>
          </>
        ) : message ? (
          <>
            <span className="text-slate-600">/</span>
            <span className="truncate text-slate-500">{message}</span>
          </>
        ) : null}
      </div>
      <div className="hidden w-36 items-center gap-2 lg:flex">
        <ProgressBar value={progressPercent} />
        <span className="shrink-0 font-mono tabular-nums text-slate-500">{Math.round(progressPercent)}%</span>
      </div>
      <Badge tone={failed > 0 ? 'warning' : 'neutral'} className="shrink-0">
        <Icon name="layers" size={12} />
        {total > 0 ? `${completed} / ${total}` : 'No queue'}
      </Badge>
      {failed > 0 ? <span className="hidden text-amber-300 sm:inline">{failed} failed</span> : null}
      <span className={cx('hidden shrink-0 font-mono tabular-nums text-slate-500 sm:inline', !jobActive && 'text-slate-600')}>
        {elapsed}
      </span>
    </div>
  );
}

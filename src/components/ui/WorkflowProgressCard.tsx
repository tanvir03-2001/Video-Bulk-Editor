import type { IconName } from './Icon';
import { Badge, Icon, Panel, ProgressBar, StatusDot } from './ui';
import { formatEstimatedRemaining } from '../../utils/progress';

interface WorkflowProgressCardProps {
  icon: IconName;
  title: string;
  description: string;
  status: string;
  statusLabel: string;
  progressPercent: number;
  currentFile: string | null;
  currentStep?: string | null;
  completed: number;
  total: number;
  failed: number;
  active: boolean;
  elapsedMs: number;
  message: string | null;
}

export function WorkflowProgressCard({
  icon,
  title,
  description,
  status,
  statusLabel,
  progressPercent,
  currentFile,
  currentStep,
  completed,
  total,
  failed,
  active,
  elapsedMs,
  message,
}: WorkflowProgressCardProps) {
  const finished = ['completed', 'preview_ready'].includes(status);
  const hasProgress = total > 0 || progressPercent > 0;
  const estimatedRemaining = formatEstimatedRemaining(elapsedMs, progressPercent, active);

  return (
    <Panel className="space-y-3 border-surface-border bg-surface/80 p-4" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="rounded-md border border-surface-border bg-surface-raised p-2 text-sky-300">
            <Icon name={icon} size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <Badge tone={active ? 'accent' : finished ? 'success' : failed > 0 ? 'warning' : 'neutral'}>
          <StatusDot tone={active ? 'active' : finished ? 'success' : failed > 0 ? 'danger' : 'neutral'} />
          {statusLabel}
        </Badge>
      </div>

      {hasProgress ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-lg font-semibold tabular-nums text-white">
              {Math.round(progressPercent)}%
            </span>
            <div className="text-right text-xs text-slate-500">
              <p>{completed} / {total || '—'} complete</p>
              <p className="mt-0.5 font-medium text-sky-300">{estimatedRemaining}</p>
            </div>
          </div>
          <ProgressBar value={progressPercent} tone={failed > 0 ? 'warning' : finished ? 'success' : 'accent'} />
        </>
      ) : (
        <div className="rounded-md border border-dashed border-surface-border bg-surface px-3 py-2 text-xs text-slate-500">
          No active run. Start this workflow to see live progress here.
        </div>
      )}

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="min-w-0 rounded-md border border-surface-border bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.1em] text-slate-600">Current item</p>
          <p className="mt-1 truncate font-mono text-slate-300" title={currentFile ?? undefined}>
            {currentFile ?? (active ? 'Starting…' : '—')}
          </p>
        </div>
        <div className="rounded-md border border-surface-border bg-surface px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.1em] text-slate-600">Step</p>
          <p className="mt-1 truncate text-slate-300">{currentStep ?? message ?? 'Ready'}</p>
        </div>
      </div>

      {failed > 0 ? (
        <p className="text-xs text-amber-300">
          {failed} item{failed === 1 ? '' : 's'} failed. Review Activity & Progress for details.
        </p>
      ) : null}
    </Panel>
  );
}

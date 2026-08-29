import type { LogEntry } from '../types/processing';

interface LogPanelProps {
  logs: LogEntry[];
  title?: string;
  compact?: boolean;
}

export function LogPanel({ logs, title = 'Log', compact = true }: LogPanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-md border border-surface-border bg-surface px-3 py-2.5">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">{title}</p>
        <span className="font-mono text-[10px] tabular-nums text-slate-600">{logs.length} events</span>
      </div>
      <div
        className={
          compact
            ? 'mt-2 max-h-40 flex-1 overflow-y-auto rounded-md border border-surface-border/60 bg-black/20 p-2.5 font-mono text-xs leading-relaxed'
            : 'mt-2 min-h-[8rem] flex-1 overflow-y-auto rounded-md border border-surface-border/60 bg-black/20 p-2.5 font-mono text-xs leading-relaxed'
        }
        aria-live="polite"
      >
        {logs.length === 0 ? (
          <p className="text-slate-500">No activity yet.</p>
        ) : (
          <ul className="space-y-1">
            {logs.map((entry) => (
              <li
                key={entry.id}
                className={
                  entry.level === 'error'
                    ? 'whitespace-pre-wrap text-rose-200'
                    : entry.level === 'success'
                      ? 'text-emerald-200'
                      : 'text-slate-300'
                }
              >
                {entry.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

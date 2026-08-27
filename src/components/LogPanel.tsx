import type { LogEntry } from '../types/processing';

interface LogPanelProps {
  logs: LogEntry[];
  title?: string;
  compact?: boolean;
}

export function LogPanel({ logs, title = 'Log', compact = true }: LogPanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-md border border-surface-border bg-surface-raised px-3 py-2.5">
      <p className="shrink-0 text-xs font-medium tracking-readable text-slate-400">{title}</p>
      <div
        className={
          compact
            ? 'mt-1.5 max-h-40 flex-1 overflow-y-auto rounded-md bg-black/25 p-2.5 font-mono text-sm leading-relaxed'
            : 'mt-1.5 min-h-[8rem] flex-1 overflow-y-auto rounded-md bg-black/25 p-2.5 font-mono text-sm leading-relaxed'
        }
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

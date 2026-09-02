import type { ReactNode } from 'react';
import { cx } from '../ui/cx';

export type ShellLayoutMode = 'hub' | 'editor';

interface AppShellProps {
  sidebar: ReactNode;
  toolbar: ReactNode;
  inspector: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
  theme?: 'dark' | 'light';
  layoutMode?: ShellLayoutMode;
}

export function AppShell({
  sidebar,
  toolbar,
  inspector,
  statusBar,
  children,
  theme = 'dark',
  layoutMode = 'hub',
}: AppShellProps) {
  const editor = layoutMode === 'editor';

  return (
    <div
      className={`${theme === 'light' ? 'theme-light' : 'theme-dark'} flex h-full min-h-0 flex-col overflow-hidden bg-surface font-sans text-slate-100 antialiased`}
    >
      <div className="flex min-h-0 flex-1">
        <aside className="shrink-0">{sidebar}</aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0">{toolbar}</header>
          <div
            className={cx(
              'grid min-h-0 flex-1',
              editor
                ? 'grid-cols-1'
                : 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]',
            )}
          >
            <main
              className={cx(
                'min-h-0 min-w-0',
                editor ? 'overflow-hidden' : 'overflow-y-auto',
              )}
            >
              {children}
            </main>
            {!editor ? (
              <aside className="hidden min-h-0 overflow-hidden border-l border-surface-border bg-surface/70 xl:block">
                {inspector}
              </aside>
            ) : null}
          </div>
          <footer className="shrink-0">{statusBar}</footer>
        </div>
      </div>
    </div>
  );
}

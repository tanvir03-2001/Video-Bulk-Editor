import type { ReactNode } from 'react';

interface AppShellProps {
  sidebar: ReactNode;
  toolbar: ReactNode;
  inspector: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
  theme?: 'dark' | 'light';
}

export function AppShell({
  sidebar,
  toolbar,
  inspector,
  statusBar,
  children,
  theme = 'dark',
}: AppShellProps) {
  return (
    <div
      className={`${theme === 'light' ? 'theme-light' : 'theme-dark'} flex h-full min-h-0 flex-col overflow-hidden bg-surface font-sans text-slate-100 antialiased`}
    >
      <div className="flex min-h-0 flex-1">
        <aside className="shrink-0">{sidebar}</aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0">{toolbar}</header>
          <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_276px]">
            <main className="min-w-0 overflow-y-auto">{children}</main>
            <aside className="hidden min-h-0 border-l border-surface-border bg-surface/70 xl:block">
              {inspector}
            </aside>
          </div>
          <footer className="shrink-0">{statusBar}</footer>
        </div>
      </div>
    </div>
  );
}

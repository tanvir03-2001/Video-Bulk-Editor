import { APP_DISPLAY_NAME } from '../../../shared/appMeta';
import { Badge, Icon, StatusDot } from '../ui/ui';
import { cx } from '../ui/cx';
import type { IconName } from '../ui/Icon';

export type AppView = 'overview' | 'frames' | 'classify' | 'branding' | 'image-editor' | 'activity';

interface NavItem {
  id: AppView;
  label: string;
  icon: IconName;
  badge?: string;
  active?: boolean;
}

interface SidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  jobActive: boolean;
  activeJobLabel: string;
  frameCount: number;
  mediaCount: number;
}

export function Sidebar({
  activeView,
  onNavigate,
  jobActive,
  activeJobLabel,
  frameCount,
  mediaCount,
}: SidebarProps) {
  const items: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'layers' },
    { id: 'frames', label: 'Video → Frames', icon: 'frames', badge: frameCount ? String(frameCount) : undefined },
    { id: 'classify', label: 'Classify Split', icon: 'classify', badge: mediaCount ? String(mediaCount) : undefined },
    { id: 'branding', label: 'Video Branding', icon: 'logo' },
    { id: 'image-editor', label: 'Image Editing', icon: 'image', badge: mediaCount ? String(mediaCount) : undefined },
  ];

  return (
    <nav className="flex h-full w-[68px] flex-col border-r border-surface-border bg-surface-raised/65 lg:w-[208px]" aria-label="Main navigation">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-border px-3 lg:px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
          <Icon name="spark" size={17} />
        </div>
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-semibold tracking-tight text-white">Frame Studio</p>
          <p className="truncate text-[10px] uppercase tracking-[0.12em] text-slate-500">Creative tools</p>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        <p className="hidden px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 lg:block">
          Workspace
        </p>
        {items.map((item) => {
          const selected = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-current={selected ? 'page' : undefined}
              onClick={() => {
                onNavigate(item.id);
              }}
              className={cx(
                'group flex min-h-9 w-full items-center justify-center gap-3 rounded-md px-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 lg:justify-start lg:px-2.5',
                selected
                  ? 'bg-accent/12 text-sky-300 shadow-[inset_2px_0_0_#60a5fa]'
                  : 'text-slate-400 hover:bg-surface-hover hover:text-slate-100',
              )}
            >
              <Icon name={item.icon} size={17} className={selected ? 'text-sky-300' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="hidden min-w-0 flex-1 truncate lg:block">{item.label}</span>
              {item.badge ? (
                <Badge tone={selected ? 'accent' : 'neutral'} className="hidden lg:inline-flex">
                  {item.badge}
                </Badge>
              ) : null}
            </button>
          );
        })}

        <div className="my-4 border-t border-surface-border" />
        <p className="hidden px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 lg:block">
          Monitor
        </p>
        <button
          type="button"
          title="Activity & Progress"
          aria-current={activeView === 'activity' ? 'page' : undefined}
          onClick={() => {
            onNavigate('activity');
          }}
          className={cx(
            'group flex min-h-9 w-full items-center justify-center gap-3 rounded-md px-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 lg:justify-start lg:px-2.5',
            activeView === 'activity'
              ? 'bg-accent/12 text-sky-300 shadow-[inset_2px_0_0_#60a5fa]'
              : 'text-slate-400 hover:bg-surface-hover hover:text-slate-100',
          )}
        >
          <Icon name="activity" size={17} className="text-slate-500 group-hover:text-slate-300" />
          <span className="hidden min-w-0 flex-1 truncate lg:block">Activity & Progress</span>
          {jobActive ? (
            <span className="hidden items-center gap-1.5 lg:flex">
              <StatusDot tone="active" />
              <span className="text-[10px] text-sky-300">Live</span>
            </span>
          ) : null}
        </button>
      </div>

      <div className="shrink-0 border-t border-surface-border p-2 lg:p-3">
        <div className="flex items-center justify-center gap-2 rounded-md px-1 py-2 lg:justify-start lg:px-2">
          <StatusDot tone={jobActive ? 'active' : 'success'} />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-[11px] font-medium text-slate-300">{jobActive ? activeJobLabel : 'System ready'}</p>
            <p className="truncate text-[10px] text-slate-600" title={APP_DISPLAY_NAME}>
              Local processing
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}

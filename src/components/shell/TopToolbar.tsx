import { APP_DISPLAY_NAME } from '../../../shared/appMeta';
import { Badge, Button, IconButton, type IconName, StatusDot } from '../ui/ui';
import type { AppView } from './Sidebar';

interface TopToolbarProps {
  view: AppView;
  jobActive: boolean;
  statusLabel: string;
  primaryAction?: { label: string; icon: IconName; onClick: () => void; disabled?: boolean };
  secondaryAction?: { label: string; icon: IconName; onClick: () => void; disabled?: boolean };
  onActivity: () => void;
}

const viewTitles: Record<AppView, string> = {
  overview: 'Overview',
  frames: 'Video → Frames',
  classify: 'Classify Split',
  branding: 'Video Branding',
  activity: 'Activity & Progress',
};

export function TopToolbar({
  view,
  jobActive,
  statusLabel,
  primaryAction,
  secondaryAction,
  onActivity,
}: TopToolbarProps) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-surface-border bg-surface/95 px-4 lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {APP_DISPLAY_NAME}
          </p>
          <h1 className="truncate text-sm font-semibold text-white">{viewTitles[view]}</h1>
        </div>
        {jobActive ? (
          <Badge tone="accent">
            <StatusDot tone="active" />
            {statusLabel}
          </Badge>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {primaryAction ? (
          <Button
            size="sm"
            variant="primary"
            icon={primaryAction.icon}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="hidden sm:inline-flex"
          >
            {primaryAction.label}
          </Button>
        ) : null}
        {secondaryAction ? (
          <IconButton
            icon={secondaryAction.icon}
            label={secondaryAction.label}
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            className="sm:hidden"
          />
        ) : null}
        <IconButton icon="activity" label="Open activity" onClick={onActivity} />
        <IconButton icon="settings" label="Settings" disabled />
        <IconButton icon="more" label="More options" disabled />
      </div>
    </div>
  );
}

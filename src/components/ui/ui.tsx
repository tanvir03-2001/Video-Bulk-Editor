import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';

export { Icon };
export type { IconName } from './Icon';

type ButtonVariant = 'primary' | 'success' | 'danger' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  children?: ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'border-accent/60 bg-accent text-white hover:border-accent hover:bg-accent-muted',
  success: 'border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500',
  danger: 'border-rose-500/40 bg-rose-700 text-white hover:bg-rose-600',
  secondary: 'border-surface-border bg-surface-raised text-slate-200 hover:border-slate-500 hover:bg-surface-hover',
  ghost: 'border-transparent bg-transparent text-slate-300 hover:border-surface-border hover:bg-surface-raised hover:text-white',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md border font-medium tracking-readable transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'min-h-9 px-3 text-sm',
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 16} /> : null}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: number;
}

export function IconButton({ icon, label, size = 32, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center rounded-md border border-transparent text-slate-400 transition-colors hover:border-surface-border hover:bg-surface-raised hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: 'border-surface-border bg-surface-raised text-slate-400',
    accent: 'border-accent/30 bg-accent/10 text-sky-300',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  };

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section
      className={cx('rounded-lg border border-surface-border bg-surface-raised/80', className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="rounded-md border border-surface-border bg-surface px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p
        className={cx(
          'mt-1 text-xl font-semibold tabular-nums tracking-tight',
          tone === 'success'
            ? 'text-emerald-300'
            : tone === 'warning'
              ? 'text-amber-300'
              : tone === 'danger'
                ? 'text-rose-300'
                : tone === 'accent'
                  ? 'text-sky-300'
                  : 'text-white',
        )}
      >
        {value}
      </p>
      {detail ? <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'accent',
}: {
  value: number;
  tone?: 'accent' | 'success' | 'warning';
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-slate-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-300',
          tone === 'success'
            ? 'bg-emerald-500'
            : tone === 'warning'
              ? 'bg-amber-500'
              : 'bg-accent',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon = 'folder',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface/40 px-6 py-8 text-center">
      <div className="mb-3 rounded-lg border border-surface-border bg-surface-raised p-3 text-slate-500">
        <Icon name={icon} size={22} />
      </div>
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatusDot({ tone = 'neutral' }: { tone?: 'neutral' | 'active' | 'success' | 'danger' }) {
  return (
    <span
      className={cx(
        'h-1.5 w-1.5 rounded-full',
        tone === 'active'
          ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]'
          : tone === 'success'
            ? 'bg-emerald-400'
            : tone === 'danger'
              ? 'bg-rose-400'
              : 'bg-slate-500',
      )}
    />
  );
}

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { useId, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './cx';

export { Icon };
export type { IconName } from './Icon';

export const controlBase =
  'w-full rounded-md border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-40';

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
  size = 'md',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cx(
            'font-semibold tracking-tight text-white',
            size === 'sm' ? 'text-base' : 'text-xl',
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className={cx('text-slate-400', size === 'sm' ? 'mt-0.5 text-xs' : 'mt-1 text-sm')}>
            {description}
          </p>
        ) : null}
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
  compact = false,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        'rounded-md border border-surface-border bg-surface',
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p
        className={cx(
          'mt-1 font-semibold tabular-nums tracking-tight',
          compact ? 'text-base' : 'text-xl',
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

export function Field({
  label,
  htmlFor,
  hint,
  trailing,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-medium text-slate-300">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlBase, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(controlBase, className)} {...props}>
      {children}
    </select>
  );
}

export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  formatValue,
  hint,
  marks,
}: {
  id?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  hint?: string;
  marks?: ReactNode;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <Field
      label={label}
      htmlFor={fieldId}
      hint={hint}
      trailing={
        <span className="font-mono text-xs tabular-nums text-sky-300">
          {formatValue ? formatValue(value) : value}
        </span>
      }
    >
      <input
        id={fieldId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        className="w-full accent-accent disabled:opacity-40"
      />
      {marks}
    </Field>
  );
}

export function CheckboxField({
  id,
  label,
  checked,
  disabled,
  onChange,
  hint,
}: {
  id?: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-200">
        <input
          id={fieldId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="mt-0.5 h-4 w-4 rounded border-surface-border accent-accent disabled:opacity-40"
        />
        <span>{label}</span>
      </label>
      {hint ? <p className="pl-6 text-[11px] leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cx('overflow-hidden rounded-lg border border-surface-border bg-surface', className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} className="shrink-0 text-slate-500" />
      </button>
      {open ? <div className="space-y-3 border-t border-surface-border px-3.5 py-3">{children}</div> : null}
    </div>
  );
}

export function WorkspacePage({
  children,
  className,
  maxWidth = '1280',
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: '1280' | '1440';
}) {
  return (
    <div
      className={cx(
        'mx-auto flex w-full flex-col gap-5 p-5 lg:gap-6 lg:p-7',
        maxWidth === '1440' ? 'max-w-[1440px]' : 'max-w-[1280px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EditorChrome({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex h-full min-h-0 flex-col overflow-hidden', className)}>{children}</div>
  );
}

export function ToolbarRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex shrink-0 flex-wrap items-center gap-2 border-b border-surface-border bg-surface/80 px-3 py-2.5 lg:px-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AlertBanner({
  title,
  children,
  tone = 'danger',
}: {
  title: string;
  children: ReactNode;
  tone?: 'danger' | 'warning' | 'info';
}) {
  const tones = {
    danger: 'border-rose-500/30 bg-rose-950/20 text-rose-100',
    warning: 'border-amber-500/30 bg-amber-950/20 text-amber-100',
    info: 'border-accent/30 bg-accent/5 text-slate-100',
  };
  const bodyTones = {
    danger: 'text-rose-200/80',
    warning: 'text-amber-200/80',
    info: 'text-slate-400',
  };
  return (
    <Panel className={cx('flex items-start gap-3 p-3.5', tones[tone])} role="alert">
      <Icon
        name={tone === 'info' ? 'info' : 'alert'}
        size={16}
        className={tone === 'danger' ? 'mt-0.5 shrink-0 text-rose-300' : 'mt-0.5 shrink-0 text-amber-300'}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <div className={cx('mt-1 text-sm leading-relaxed', bodyTones[tone])}>{children}</div>
      </div>
    </Panel>
  );
}

export function SettingsBlock({
  title,
  description,
  children,
  className,
  bare = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  const body = (
    <>
      <div>
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {children}
    </>
  );
  if (bare) {
    return <div className={cx('space-y-3', className)}>{body}</div>;
  }
  return <Panel className={cx('space-y-3 bg-surface p-3.5', className)}>{body}</Panel>;
}

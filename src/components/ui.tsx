import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- Button

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-900 text-white hover:bg-brand-700 active:bg-brand-950',
  secondary: 'bg-white text-brand-900 hover:bg-brand-50',
  ghost: 'text-slate-600 hover:bg-white hover:text-brand-900',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-emerald-700 text-white hover:bg-emerald-800',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px] gap-1.5 rounded-full',
  md: 'h-11 px-5 text-sm gap-2 rounded-full',
  lg: 'h-14 px-6 text-[15px] gap-2 rounded-full',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150',
        'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Layout bits

/** The page's h1 row: a noun title, an optional one-line sentence about the data, real actions only. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-[1.05] font-medium tracking-[-0.035em] text-brand-900 sm:text-[42px]">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-6 animate-spin text-brand-500', className)} />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500" role="status">
      <Spinner className="size-5" /> {label}
    </div>
  );
}

/** A flat grey bar at the real size of the value it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx('skeleton block', className)} />;
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 text-slate-400 [&>svg]:size-6">{icon}</div>
      <p className="text-[15px] font-medium text-brand-900">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-600">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[20px] bg-red-50 px-5 py-4 text-sm text-red-800" role="alert">
      <span className="font-medium">Couldn't load this.</span>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline-offset-2 hover:underline">
          Retry
        </button>
      )}
    </div>
  );
}

const BADGE = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-700/15',
  gray: 'bg-slate-100 text-slate-700 ring-slate-600/10',
  blue: 'bg-brand-50 text-brand-800 ring-brand-700/15',
  amber: 'bg-saffron-50 text-saffron-700 ring-saffron-600/20',
  violet: 'bg-saffron-50 text-saffron-700 ring-saffron-600/20',
  red: 'bg-red-50 text-red-800 ring-red-700/15',
};

export function Badge({ color = 'gray', children }: { color?: keyof typeof BADGE; children: ReactNode }) {
  return (
    <span className={cx('inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', BADGE[color])}>
      {children}
    </span>
  );
}

/** Payment method chips: Cash green, UPI saffron, Card navy. */
export const PAYMENT_BADGE: Record<string, keyof typeof BADGE> = { CASH: 'green', UPI: 'amber', CARD: 'blue' };

// ---------------------------------------------------------------- Segmented control

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  className,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('inline-flex gap-1.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-full font-medium whitespace-nowrap transition-colors duration-150',
              size === 'sm' ? 'h-8 px-3.5 text-xs' : 'h-10 px-4.5 text-[13px]',
              active ? 'bg-brand-900 text-white' : 'bg-white text-brand-800 hover:bg-brand-50',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Animated number

/** Counts up to `value` once when it first appears or changes; static when reduced motion is preferred. */
export function AnimatedNumber({ value, format, duration = 700 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular">{format(shown)}</span>;
}

// ---------------------------------------------------------------- Field

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-red-700">{error}</p> : hint && <p className="mt-1.5 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label?: string; id?: string }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200', checked ? 'bg-brand-900' : 'bg-slate-300')}
    >
      <span className={cx('inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-current/25 px-1 py-px font-sans text-[11px] leading-none font-medium opacity-80">{children}</kbd>;
}

// ---------------------------------------------------------------- Modal

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const MODAL_SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="fade-in absolute inset-0 bg-brand-950/40" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cx(
          'modal-panel relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)] outline-none sm:rounded-[28px]',
          MODAL_SIZES[size],
        )}
      >
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-3">
          <h2 className="text-xl font-medium tracking-[-0.02em] text-brand-900">{title}</h2>
          <button onClick={onClose} className="-mr-1.5 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-raised hover:text-brand-900" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-6 pt-2 pb-6">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-slate-700">{message}</div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Pagination

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 text-sm text-slate-600">
      <span className="tabular">
        {from}–{to} of <b className="font-semibold text-brand-900">{total}</b>
      </span>
      <div className="flex items-center gap-2">
        <span className="tabular hidden text-xs text-slate-500 sm:inline">
          Page {page} of {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

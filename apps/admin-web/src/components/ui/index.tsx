import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../utils/cn';

// Button.

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  // Combine shared styles with the selected size, visual variant, and caller overrides.
  const base =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50';
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' };
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-ink-100 text-ink-900 hover:bg-ink-200',
    ghost: 'bg-transparent text-ink-700 hover:bg-ink-100',
    danger: 'bg-danger-500 text-white hover:bg-danger-600',
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

// Input.

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'block w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm placeholder-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
        className,
      )}
      {...rest}
    />
  );
}

// Textarea.

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'block w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm placeholder-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
        className,
      )}
      {...rest}
    />
  );
}

// Select.

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'block w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

// Card.

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

// Badge.

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

export function Badge({ tone = 'neutral', className, children, ...rest }: BadgeProps) {
  // Translate the semantic tone into its shared visual class.
  const tones = {
    neutral: 'badge-neutral',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
  };
  return (
    <span className={cn(tones[tone], className)} {...rest}>
      {children}
    </span>
  );
}

// PageHeader.

export function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ModalShell.

export function ModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  // Keep modal content out of the DOM while closed; callers own dialog-specific behavior.
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-ink-500 hover:text-ink-700" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// TableWrapper.

export function TableWrapper({ children }: { children: ReactNode }) {
  // Provide a common panel frame and horizontal scrolling for wide tables.
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

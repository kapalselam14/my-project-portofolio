import { createContext, useCallback, useContext, useReducer, useRef, type ReactNode } from 'react';

// Types.

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

// Context.

const ToastContext = createContext<ToastContextValue | null>(null);

type Action = { type: 'ADD'; toast: Toast } | { type: 'REMOVE'; id: string };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'ADD':
      return [...state, action.toast];
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

// Provider.

const AUTO_DISMISS_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    dispatch({ type: 'REMOVE', id });
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      dispatch({ type: 'ADD', toast: { id, message, variant } });
      const t = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, t);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

// Visual region.

const VARIANT_STYLES: Record<
  ToastVariant,
  { bar: string; icon: string; bg: string; text: string }
> = {
  success: {
    bar: 'bg-success-500',
    icon: '✓',
    bg: 'bg-white dark:bg-ink-800',
    text: 'text-success-700 dark:text-success-400',
  },
  error: {
    bar: 'bg-danger-500',
    icon: '✕',
    bg: 'bg-white dark:bg-ink-800',
    text: 'text-danger-700  dark:text-danger-400',
  },
  warning: {
    bar: 'bg-warning-500',
    icon: '!',
    bg: 'bg-white dark:bg-ink-800',
    text: 'text-warning-700 dark:text-warning-400',
  },
  info: {
    bar: 'bg-brand-500',
    icon: 'i',
    bg: 'bg-white dark:bg-ink-800',
    text: 'text-brand-700   dark:text-brand-300',
  },
};

function ToastRegion({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const s = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex min-w-[280px] max-w-sm items-start overflow-hidden rounded-xl border border-ink-200 dark:border-ink-700 shadow-panel ${s.bg} animate-slide-in`}
          >
            {/* Accent bar */}
            <div className={`w-1 shrink-0 self-stretch ${s.bar}`} />
            {/* Icon */}
            <span
              className={`mx-3 mt-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${s.bar} text-white`}
            >
              {s.icon}
            </span>
            {/* Message */}
            <p className={`flex-1 py-3 pr-2 text-sm font-medium ${s.text}`}>{t.message}</p>
            {/* Dismiss */}
            <button
              onClick={() => onDismiss(t.id)}
              className="m-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors"
              aria-label="Dismiss notification"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

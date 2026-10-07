import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Reusable side panel for detail views.
 *
 * The panel keeps keyboard focus inside the dialog, closes with Escape,
 * and restores focus to the control that opened it.
 */
export function SlidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  // Keep the event handler pointed at the latest callback without rebuilding
  // the keyboard listener every time a parent re-renders.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // Move focus into the panel when it opens and remember the element that launched it.
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      // Wrap keyboard navigation at either end so focus cannot escape the modal panel.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

      if (!focusable || focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }

      previousFocusRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  const titleId = 'slide-panel-title';
  const descriptionId = subtitle ? 'slide-panel-subtitle' : undefined;
  // Fit narrow viewports without allowing the configured panel width to exceed the screen.
  const panelWidth =
    typeof window === 'undefined' ? width : Math.min(width, window.innerWidth);

  return (
    <>
      {/* Clicking the scrim closes the panel without affecting panel content. */}
      <div
        className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Detail dialog. */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-[−8px_0_32px_rgba(0,0,0,0.12)] dark:bg-ink-800"
        style={{ width: panelWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {/* Header and close control. */}
        <div className="flex shrink-0 items-center justify-between border-b border-ink-200 bg-white px-6 py-4 dark:border-ink-700 dark:bg-ink-800">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-sm font-bold text-ink-900 dark:text-ink-100">
              {title}
            </h2>
            {subtitle && (
              <p
                id={descriptionId}
                className="mt-0.5 truncate text-xs text-ink-400 dark:text-ink-500"
              >
                {subtitle}
              </p>
            )}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700 dark:hover:text-ink-100"
            aria-label="Close panel"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable detail content. */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </>
  );
}

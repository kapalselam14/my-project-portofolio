import { useEffect, useRef } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Lightweight accessible confirmation dialog.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);

  // Keep Escape handling current without reinstalling the document listener on every render.
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;

    // Remember the opener so keyboard focus can return to it after the dialog closes.
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      // Cycle Tab navigation between the first and last controls to keep focus in the dialog.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );

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
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      if (previouslyFocusedRef.current?.isConnected) {
        previouslyFocusedRef.current.focus();
      }

      previouslyFocusedRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  const titleId = 'confirm-dialog-title';
  const descriptionId = description
    ? 'confirm-dialog-description'
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4 dark:bg-black/60"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-6 shadow-panel dark:border-ink-700 dark:bg-ink-800"
      >
        <h3
          id={titleId}
          className="text-base font-bold text-ink-900 dark:text-ink-100"
        >
          {title}
        </h3>

        {description && (
          <p
            id={descriptionId}
            className="mt-2 text-sm text-ink-500 dark:text-ink-400"
          >
            {description}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="btn-outline rounded-xl px-4 py-2 text-sm"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors ${
              destructive
                ? 'bg-danger-500 hover:bg-danger-600'
                : 'bg-brand-500 hover:bg-brand-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

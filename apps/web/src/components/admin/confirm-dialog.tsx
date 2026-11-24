'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Confirmation for destructive staff actions. A native modal <dialog>: the
 * page behind is inert (focus stays inside), Esc cancels, and focus returns
 * to the control that opened it. The body should name the target and say
 * what happens next.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'bad' | 'default';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="adm-dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Esc: keep the dialog under React's control rather than letting it close itself.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      {open ? (
        <div className="flex flex-col gap-4 p-6 sm:p-7">
          <h2 id={titleId} className="text-[22px] leading-snug text-strong">
            {title}
          </h2>
          <div id={bodyId} className="text-[15px] leading-relaxed text-body">
            {body}
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-2.5">
            {/* Destructive dialogs open on Cancel so a stray Enter does no harm. */}
            <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy} autoFocus={tone === 'bad'}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={tone === 'bad' ? 'btn btn-bad' : 'btn btn-primary'}
              onClick={onConfirm}
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

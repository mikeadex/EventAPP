'use client';

import { useEffect, useId, useRef, useState } from 'react';

/** A light check before sending; the API validates again (AdminContactSchema). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Change contact email" for an unclaimed church: a modal form (name
 * optional, email required). Saving voids the old claim and take-down links
 * and sends a new claim email to the new address.
 */
export function ContactDialog({
  open,
  hostName,
  currentName,
  currentEmail,
  busy,
  onSave,
  onCancel,
}: {
  open: boolean;
  hostName: string;
  currentName: string | null;
  currentEmail: string | null;
  busy: boolean;
  /** Saves and closes the dialog; the result is reported on the page. */
  onSave: (body: { contactName?: string; contactEmail: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const nameId = useId();
  const emailId = useId();
  const errId = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setName(currentName ?? '');
      setEmail('');
      setError(null);
      dialog.showModal();
      // showModal() moves focus to the first field; the email is the one to change.
      emailRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, currentName]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const contactEmail = email.trim().toLowerCase();
    const contactName = name.trim();
    if (!EMAIL.test(contactEmail) || contactEmail.length > 254) {
      setError('Enter a valid email address.');
      return;
    }
    if (currentEmail && contactEmail === currentEmail.toLowerCase()) {
      setError('That’s already the contact email. Use “Resend claim email” to send the link again.');
      return;
    }
    setError(null);
    await onSave({ contactName: contactName || undefined, contactEmail });
  }

  return (
    <dialog
      ref={ref}
      className="adm-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      {open ? (
        <form className="flex flex-col gap-4 p-6 sm:p-7" onSubmit={(e) => void submit(e)} noValidate>
          <h2 id={titleId} className="text-[22px] leading-snug text-strong">
            Change contact email
          </h2>
          <p className="text-[15px] leading-relaxed text-body">
            The claim email for {hostName} goes to this address. Saving cancels the links already sent
            {currentEmail ? ` to ${currentEmail}` : ''} and sends a new claim email.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className="label">
              Contact name <span className="text-muted">(optional)</span>
            </label>
            <input
              id={nameId}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={emailId} className="label">
              Contact email
            </label>
            <input
              id={emailId}
              className="input"
              type="email"
              inputMode="email"
              autoComplete="off"
              required
              ref={emailRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errId : undefined}
            />
            {error ? (
              <p id={errId} className="error-text" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-2.5">
            <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy || undefined}>
              {busy ? 'Saving…' : 'Save and send'}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}

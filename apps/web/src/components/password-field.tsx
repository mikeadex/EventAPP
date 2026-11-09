'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  label: string;
};

/**
 * A labelled password input that can be read back.
 *
 * The mobile apps gained this first; the reasoning carries over. A twelve
 * character minimum typed blind is easy to get wrong, and the cost of a silent
 * typo is a password reset that goes to an inbox the person may not be able to
 * reach. The `type` swap is all that is needed — the browser keeps the value,
 * and `autoComplete` still reaches the password manager either way.
 */
export function PasswordField({ label, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="block">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          {...rest}
          id={id}
          type={visible ? 'text' : 'password'}
          className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 pr-11 text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Outside the tab order: it is a convenience, and stopping between
          // the password and the submit button on every sign-in is not one.
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 hover:text-ink-600"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.16 3.19M6.61 6.61A18 18 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

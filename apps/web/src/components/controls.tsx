'use client';

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './icons';

/** On/off switch. `role="switch"` + `aria-checked`, per the design's a11y rules. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[30px] w-[52px] flex-none rounded-full border transition-colors disabled:opacity-50 ${
        checked ? 'border-accent bg-accent' : 'border-line-2 bg-surface-2'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[22px] w-[22px] rounded-full transition-[left] duration-200 ${
          // The design's knob is white on the accent in both themes.
          checked ? 'left-[25px] bg-white' : 'left-[3px] bg-muted'
        }`}
      />
    </button>
  );
}

/** A setting row: title + hint on the left, a switch on the right. */
export function SwitchRow({
  title,
  hint,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-[16px]">{title}</span>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

/** − n + stepper. Keyboard operable: real buttons. */
export function Stepper({
  value,
  min = 0,
  max,
  onChange,
  label,
  decLabel,
  incLabel,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
  /** Button names, e.g. "Remove a place" / "Add a place" (the design's wording). */
  decLabel?: string;
  incLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className="icon-btn !h-9 !w-9 !text-accent"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={decLabel ?? `Fewer — ${label}`}
      >
        <Icon name="minus" size={14} />
      </button>
      <span className="w-6 text-center text-[16px]" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="icon-btn !h-9 !w-9 !text-accent"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={incLabel ?? `More — ${label}`}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}

/**
 * Labelled form field. Wires the label, the hint and the error to the control
 * with `aria-describedby`, and marks it invalid when there is an error.
 */
export function Field({
  label,
  hint,
  error,
  aside,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  aside?: ReactNode;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {aside}
      </span>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <span id={hintId} className="hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} className="error-text">
          {error}
        </span>
      )}
    </div>
  );
}

/** Password input that can be read back. Mirrors the mobile apps. */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>
>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input {...props} ref={ref} type={visible ? 'text' : 'password'} className="input pr-14" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Outside the tab order: stopping on it between password and submit
        // on every sign-in is not a convenience.
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-4 text-faint transition-colors hover:text-accent"
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} />
      </button>
    </span>
  );
});


'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

/**
 * Become-a-host header: eyebrow, a 44px step title, an intro line, then a
 * bar per step and "Step N of 3" underneath.
 */
export function OnboardingHeader({
  eyebrow,
  title,
  intro,
  total,
  current,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  total: number;
  current: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="eyebrow text-accent">{eyebrow}</span>
      <h1 className="text-[34px] leading-[1.1] text-strong sm:text-[44px]">{title}</h1>
      <p className="text-[16px] leading-[1.6] text-body">{intro}</p>
      <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 rounded-full ${i <= current ? 'bg-accent' : 'bg-line-2'}`} />
        ))}
      </div>
      <span className="text-[13px] text-muted">
        Step {current + 1} of {total}
      </span>
    </div>
  );
}

/** Create/edit event steps as clickable pills, with the number in mono. */
export function StepTabs({
  steps,
  current,
  onSelect,
  disabledSteps,
}: {
  steps: string[];
  current: number;
  onSelect: (i: number) => void;
  /** Steps that can't be opened yet. */
  disabledSteps?: number[];
}) {
  return (
    <ol aria-label="Steps" className="flex flex-wrap gap-2">
      {steps.map((s, i) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => onSelect(i)}
            disabled={disabledSteps?.includes(i) || undefined}
            aria-current={i === current ? 'step' : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[14px] transition-colors ${
              i === current ? 'border-line-3 bg-soft text-accent-ink' : 'border-line text-ink-2 hover:text-ink'
            }`}
          >
            <span className="font-mono text-[12px]">{String(i + 1).padStart(2, '0')}</span>
            {s}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Stacked radio cards: a ring with a dot, a name and a line of description. */
export function RadioCards<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; description: string }[];
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    const next = options[n];
    if (next) onChange(next.value);
    refs.current[n]?.focus();
  }
  return (
    <fieldset>
      <legend className="mb-3.5 text-[18px] text-strong">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="flex flex-col gap-2.5">
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={`flex items-center gap-4 rounded-[18px] border px-5 py-[18px] text-left transition-colors ${
                on ? 'border-accent bg-softer' : 'border-line hover:border-line-2'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.5px] ${
                  on ? 'border-accent' : 'border-line-3'
                }`}
              >
                {on && <span className="h-3 w-3 rounded-full bg-accent" />}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[18px] text-strong">{o.label}</span>
                {/* `muted` on the selected card's tint is 4.4:1 in dark, just under AA. */}
                <span className={`text-[14px] ${on ? 'text-body' : 'text-muted'}`}>{o.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A fieldset of `.chip` toggles (aria-pressed), one of which is on. */
export function PressedChips<T extends string>({
  legend,
  hint,
  value,
  onChange,
  options,
  large = false,
}: {
  legend: string;
  hint?: ReactNode;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  large?: boolean;
}) {
  return (
    <fieldset className="flex flex-col">
      <legend className="label">{legend}</legend>
      {hint && <span className="hint mt-1">{hint}</span>}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`chip ${large ? '!h-11 !px-[22px] !text-[15px]' : ''}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Four-segment strength meter. Only the length rule is enforced (by the API,
 * 12+ characters); the other three are guidance and say so.
 *
 * `summary` swaps the rule checklist for one line of guidance under the
 * segments — the create-account design. `checklist` is the reset-password
 * design: no segments, a boxed list with ticks. Settings keep the default.
 */
export const PASSWORD_MIN = 12;

const RULES: { label: string; long: string; test: (p: string) => boolean }[] = [
  { label: `${PASSWORD_MIN}+ characters`, long: `At least ${PASSWORD_MIN} characters`, test: (p) => p.length >= PASSWORD_MIN },
  { label: 'A number', long: 'A number', test: (p) => /\d/.test(p) },
  { label: 'A symbol', long: 'A symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
  { label: 'Upper and lower case', long: 'Upper and lower case', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
];

function Tick({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2.5 text-[14px] ${ok ? 'text-accent' : 'text-muted'}`}>
      <span
        aria-hidden="true"
        className="inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border border-current text-[11px]"
      >
        {ok ? '✓' : ''}
      </span>
      {label}
      <span className="sr-only">{ok ? ' — done' : ' — not yet'}</span>
    </li>
  );
}

function summaryOf(value: string, score: number) {
  if (value.length < PASSWORD_MIN) {
    const left = PASSWORD_MIN - value.length;
    return value ? `${left} more character${left === 1 ? '' : 's'} to go.` : `At least ${PASSWORD_MIN} characters.`;
  }
  if (score >= 4) return 'Very strong.';
  if (score === 3) return 'Strong — one more of a number, symbol or mixed case to finish it.';
  return 'Long enough. A number, a symbol or mixed case makes it stronger.';
}

export function PasswordMeter({
  value,
  summary = false,
  checklist = false,
}: {
  value: string;
  summary?: boolean;
  checklist?: boolean;
}) {
  const passed = RULES.map((r) => r.test(value));
  const score = passed.filter(Boolean).length;
  if (checklist) {
    const checked = RULES.map((r) => ({ ...r, ok: r.test(value) }));
    // Only the length is enforced, so it alone sits under "Must include";
    // the rest are honest suggestions rather than requirements.
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
        <span className="eyebrow text-[10px] text-faint">Must include</span>
        <ul className="flex flex-col gap-2">
          {checked.slice(0, 1).map((r) => (
            <Tick key={r.label} ok={r.ok} label={r.long} />
          ))}
        </ul>
        <span className="eyebrow mt-1 text-[10px] text-faint">Stronger with</span>
        <ul className="flex flex-col gap-2">
          {checked.slice(1).map((r) => (
            <Tick key={r.label} ok={r.ok} label={r.long} />
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {RULES.map((r, i) => (
          <span
            key={r.label}
            className={`h-1 rounded-full transition-colors ${i < score ? 'bg-accent' : 'bg-line-2'}`}
          />
        ))}
      </div>
      {summary ? (
        <span aria-live="polite" className="text-[13px] text-muted">
          {summaryOf(value, score)}
        </span>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
          {RULES.map((r, i) => (
            <li key={r.label} className={passed[i] ? 'text-ink-2' : 'text-faint'}>
              <span aria-hidden="true">{passed[i] ? '✓ ' : '· '}</span>
              {r.label}
              {i === 0 && <span className="sr-only">{passed[i] ? ' (met)' : ' (required)'}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

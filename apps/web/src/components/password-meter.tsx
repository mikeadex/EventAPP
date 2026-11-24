/**
 * Four-segment strength meter. Only the length rule is enforced (by the API,
 * 12+ characters); the other three are guidance and say so.
 */
export const PASSWORD_MIN = 12;

const RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: `${PASSWORD_MIN}+ characters`, test: (p) => p.length >= PASSWORD_MIN },
  { label: 'A number', test: (p) => /\d/.test(p) },
  { label: 'A symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
  { label: 'Upper and lower case', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
];

export function PasswordMeter({ value }: { value: string }) {
  const passed = RULES.map((r) => r.test(value));
  const score = passed.filter(Boolean).length;
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
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        {RULES.map((r, i) => (
          <li key={r.label} className={passed[i] ? 'text-ink-2' : 'text-faint'}>
            <span aria-hidden="true">{passed[i] ? '✓ ' : '· '}</span>
            {r.label}
            {i === 0 && <span className="sr-only">{passed[i] ? ' (met)' : ' (required)'}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

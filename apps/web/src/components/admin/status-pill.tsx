export type StatusTone = 'default' | 'ok' | 'warn' | 'bad';

/** Status as text plus a dot — never colour alone. */
export function StatusPill({ tone = 'default', children }: { tone?: StatusTone; children: React.ReactNode }) {
  return (
    <span className={tone === 'default' ? 'st' : `st st-${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

/** Headline number: eyebrow label, value, optional delta or sub-line. Use inside `.kpis`. */
export function KpiCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Draws the value in the accent colour, for the number that needs attention. */
  highlight?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-1.5 p-5">
      <span className="eyebrow text-[10px] text-faint">{label}</span>
      <span className={`kpi-value text-[30px] leading-tight ${highlight ? 'text-accent' : 'text-strong'}`}>{value}</span>
      {sub ? <span className="text-[13px] text-muted">{sub}</span> : null}
    </div>
  );
}

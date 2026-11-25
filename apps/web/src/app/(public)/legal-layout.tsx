/**
 * Shared shell for the legal pages (/privacy, /terms).
 *
 * These pages must stay reachable at stable public URLs: both the App Store
 * and Google Play require a privacy policy URL on the store listing, and the
 * mobile app links here from Settings → About.
 */
export function LegalPage({
  title,
  updated,
  eyebrow = 'Legal',
  children,
}: {
  title: string;
  updated: string;
  /** "Legal" for policies; support and account pages pass their own. */
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="wrap max-w-[824px] pt-12">
      <span className="eyebrow text-accent">{eyebrow}</span>
      <h1 className="h1 mt-3">{title}</h1>
      <p className="mt-3 text-[14px] text-faint">Last updated {updated}</p>
      <div className="rule-x my-10" />
      <div className="space-y-8 text-[16px] leading-[1.75] text-body [&_a]:text-accent [&_strong]:text-ink">
        {children}
      </div>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[22px] text-strong">{heading}</h2>
      {children}
    </section>
  );
}

/**
 * The legal-basis and retention tables.
 *
 * Stacks into labelled blocks below `sm` rather than scrolling sideways. A
 * horizontally scrolling table hides the right-hand column behind a gesture
 * nobody knows is there, and on these two tables that column is the actual
 * answer — the legal basis, or how long we keep something. Repeating the
 * column name against each value costs a little space and loses nothing.
 */
export function LegalTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <table className="w-full border-collapse text-sm">
      {/* Hidden while stacked: each cell carries its own label there. */}
      <thead className="hidden sm:table-header-group">
        <tr className="border-b border-line-2 text-left">
          {columns.map((c) => (
            <th key={c} className="py-2 pr-4 text-strong last:pr-0">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block sm:table-row-group">
        {rows.map((row, i) => (
          <tr
            key={i}
            className="block border-b border-line py-3 sm:table-row sm:py-0 sm:align-top"
          >
            {row.map((cell, j) => (
              <td key={j} className="block py-1 sm:table-cell sm:py-3 sm:pr-4 sm:last:pr-0">
                <span className="mb-0.5 block text-[12px] text-muted sm:hidden">
                  {columns[j]}
                </span>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

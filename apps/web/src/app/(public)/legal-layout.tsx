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
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl text-ink-900">{title}</h1>
      <p className="mt-3 text-sm text-ink-500">Last updated {updated}</p>
      <div className="mt-10 space-y-8 text-ink-700 leading-relaxed">{children}</div>
    </main>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl text-ink-900">{heading}</h2>
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
        <tr className="border-b border-ink-200 text-left">
          {columns.map((c) => (
            <th key={c} className="py-2 pr-4 font-medium text-ink-900 last:pr-0">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block sm:table-row-group">
        {rows.map((row, i) => (
          <tr
            key={i}
            className="block border-b border-ink-100 py-3 sm:table-row sm:py-0 sm:align-top"
          >
            {row.map((cell, j) => (
              <td key={j} className="block py-1 sm:table-cell sm:py-3 sm:pr-4 sm:last:pr-0">
                <span className="mb-0.5 block text-xs font-medium text-ink-500 sm:hidden">
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

'use client';

export interface Column<Row> {
  key: string;
  label: string;
  render: (row: Row) => React.ReactNode;
  /** Visually hidden header, e.g. for an actions column. */
  hideLabel?: boolean;
}

/**
 * Admin data table: `.tbl` inside a card that scrolls sideways on narrow
 * screens. The selected row is highlighted (`tr.on`). Row clicks are a
 * pointer convenience only — give each row a real link or button in a cell
 * for keyboard users.
 */
export function DataTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  selectedKey,
  onRowClick,
  empty = 'Nothing here.',
}: {
  /** Accessible name for the table. */
  label: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  selectedKey?: string | null;
  onRowClick?: (row: Row) => void;
  empty?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="card p-6 text-[14px] text-muted">{empty}</p>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="tbl" aria-label={label}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.hideLabel ? <span className="sr-only">{c.label}</span> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const on = selectedKey != null && key === selectedKey;
            return (
              <tr
                key={key}
                className={on ? 'on' : undefined}
                data-clickable={onRowClick ? '' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key}>{c.render(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

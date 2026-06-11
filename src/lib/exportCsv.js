// Lightweight CSV export helper — builds a CSV string from rows and triggers a download.
// columns: [{ key, label, format? }]
export function exportToCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = typeof c.key === 'function' ? c.key(row) : row[c.key];
          return esc(c.format ? c.format(raw, row) : raw);
        })
        .join(',')
    )
    .join('\n');

  const csv = `${header}\n${body}`;
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
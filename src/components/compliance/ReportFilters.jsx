import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const selectClass = "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function ReportFilters({ year, month, branch, onChange, showMonth = false }) {
  const [branches, setBranches] = useState([]);
  const years = [];
  const current = new Date().getFullYear();
  for (let y = current; y >= current - 4; y -= 1) years.push(y);

  useEffect(() => {
    base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000).then((data) => {
      const names = [...new Set(data
        .map((e) => e.branch || e.fields?.Branch)
        .filter(Boolean)
        .map((b) => String(b).trim()))].sort((a, b) => a.localeCompare(b));
      setBranches(names);
    });
  }, []);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Year</label>
        <select value={year} onChange={(e) => onChange({ year: Number(e.target.value), month, branch })} className={selectClass}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {showMonth && (
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Month</label>
          <select value={month || ''} onChange={(e) => onChange({ year, month: e.target.value ? Number(e.target.value) : null, branch })} className={selectClass}>
            <option value="">All months</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Branch</label>
        <select value={branch || ''} onChange={(e) => onChange({ year, month, branch: e.target.value || null })} className={selectClass}>
          <option value="">All branches</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
    </div>
  );
}
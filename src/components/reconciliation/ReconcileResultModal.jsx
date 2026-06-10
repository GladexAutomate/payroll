import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { peso } from './reconcileFormat';

// Shows the saved AttendancePaySummary rows for a completed reconciliation run.
export default function ReconcileResultModal({ run, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const data = await base44.entities.AttendancePaySummary.filter(
        { period_start: run.period_start, period_end: run.period_end }, 'employee_name', 5000,
      );
      if (active) { setRows(data || []); setLoading(false); }
    })();
    return () => { active = false; };
  }, [run]);

  const q = search.trim().toLowerCase();
  const filtered = q ? rows.filter(r => (r.employee_name || '').toLowerCase().includes(q)) : rows;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Reconciliation results</h3>
            <p className="text-xs text-muted-foreground">{run.period_label} · {run.branch_filter || 'all'} branch · {peso(run.total_gross)} total gross</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-border">
          <Input placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        </div>

        <div className="overflow-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading results…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 px-2 font-medium">Employee</th>
                  <th className="py-2 px-2 font-medium text-right">Days</th>
                  <th className="py-2 px-2 font-medium text-right">Absent</th>
                  <th className="py-2 px-2 font-medium text-right">Hours</th>
                  <th className="py-2 px-2 font-medium text-right">OT</th>
                  <th className="py-2 px-2 font-medium text-right">Late (min)</th>
                  <th className="py-2 px-2 font-medium text-right">Allowances</th>
                  <th className="py-2 px-2 font-medium text-right">Gross</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-accent/40">
                    <td className="py-2 px-2">{r.employee_name || r.employee_code}</td>
                    <td className="py-2 px-2 text-right">{r.days_worked || 0}</td>
                    <td className="py-2 px-2 text-right">{r.days_absent || 0}</td>
                    <td className="py-2 px-2 text-right">{r.hours || 0}</td>
                    <td className="py-2 px-2 text-right">{r.overtime_hours || 0}</td>
                    <td className="py-2 px-2 text-right">{r.late_minutes || 0}</td>
                    <td className="py-2 px-2 text-right">{peso(r.allowances)}</td>
                    <td className="py-2 px-2 text-right font-medium">{peso(r.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !filtered.length && <p className="text-sm text-muted-foreground text-center py-8">No matching records.</p>}
        </div>
      </div>
    </div>
  );
}
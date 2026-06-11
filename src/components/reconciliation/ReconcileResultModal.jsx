import { useEffect, useState } from 'react';
import { X, Loader2, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { peso } from './reconcileFormat';
import EditSummaryRow from './EditSummaryRow';

// Shows the saved AttendancePaySummary rows for a completed reconciliation run.
// This is the full pre-payroll view: every column the payslip / payroll run uses,
// with per-row editing so HR can adjust before generating the payroll run.
export default function ReconcileResultModal({ run, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

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

  const totals = filtered.reduce((s, r) => ({
    gross: s.gross + (Number(r.gross) || 0),
    deductions: s.deductions + (Number(r.total_deductions) || 0),
    net: s.net + (Number(r.net_pay) || 0),
  }), { gross: 0, deductions: 0, net: 0 });

  const handleSaved = (updated) => {
    setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
    setEditing(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-[95vw] max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Reconciliation results</h3>
            <p className="text-xs text-muted-foreground">{run.period_label} · {run.branch_filter || 'all'} branch · {peso(totals.gross)} gross · {peso(totals.net)} net</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <Input placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <p className="text-xs text-muted-foreground">{filtered.length} employees · edit any record before running payroll</p>
        </div>

        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading results…</div>
          ) : (
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 px-3 font-medium sticky left-0 bg-card">Employee</th>
                  <th className="py-2 px-2 font-medium text-right">Days</th>
                  <th className="py-2 px-2 font-medium text-right">Abs</th>
                  <th className="py-2 px-2 font-medium text-right">Hours</th>
                  <th className="py-2 px-2 font-medium text-right">OT</th>
                  <th className="py-2 px-2 font-medium text-right">Regular</th>
                  <th className="py-2 px-2 font-medium text-right">OT Pay</th>
                  <th className="py-2 px-2 font-medium text-right">Holiday</th>
                  <th className="py-2 px-2 font-medium text-right">Leave</th>
                  <th className="py-2 px-2 font-medium text-right">Allow.</th>
                  <th className="py-2 px-2 font-medium text-right">Gross</th>
                  <th className="py-2 px-2 font-medium text-right">SSS</th>
                  <th className="py-2 px-2 font-medium text-right">PhilH.</th>
                  <th className="py-2 px-2 font-medium text-right">Pag-IBIG</th>
                  <th className="py-2 px-2 font-medium text-right">Tax</th>
                  <th className="py-2 px-2 font-medium text-right">Lates</th>
                  <th className="py-2 px-2 font-medium text-right">ATD</th>
                  <th className="py-2 px-2 font-medium text-right">Deductions</th>
                  <th className="py-2 px-2 font-medium text-right">Net Pay</th>
                  <th className="py-2 px-2 font-medium text-center">Edit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-accent/40">
                    <td className="py-2 px-3 sticky left-0 bg-card">
                      <span className="font-medium">{r.employee_name || r.employee_code}</span>
                      {r.manually_edited && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">edited</span>}
                    </td>
                    <td className="py-2 px-2 text-right">{r.days_worked || 0}</td>
                    <td className="py-2 px-2 text-right">{r.days_absent || 0}</td>
                    <td className="py-2 px-2 text-right">{r.hours || 0}</td>
                    <td className="py-2 px-2 text-right">{r.overtime_hours || 0}</td>
                    <td className="py-2 px-2 text-right">{peso(r.regular_pay)}</td>
                    <td className="py-2 px-2 text-right">{peso(r.overtime_pay)}</td>
                    <td className="py-2 px-2 text-right">{peso(r.holiday_pay)}</td>
                    <td className="py-2 px-2 text-right">{peso(r.leave_pay)}</td>
                    <td className="py-2 px-2 text-right">{peso(r.allowances)}</td>
                    <td className="py-2 px-2 text-right font-medium">{peso(r.gross)}</td>
                    <td className="py-2 px-2 text-right text-red-600">{peso(r.sss_employee)}</td>
                    <td className="py-2 px-2 text-right text-red-600">{peso(r.philhealth_employee)}</td>
                    <td className="py-2 px-2 text-right text-red-600">{peso(r.pagibig_employee)}</td>
                    <td className="py-2 px-2 text-right text-red-600">{peso(r.withholding_tax)}</td>
                    <td className="py-2 px-2 text-right text-red-600">{peso(r.lates_deduction)}</td>
                    <td className="py-2 px-2 text-right text-red-600">{peso(r.other_deductions)}</td>
                    <td className="py-2 px-2 text-right text-red-600 font-medium">{peso(r.total_deductions)}</td>
                    <td className="py-2 px-2 text-right font-bold text-green-600">{peso(r.net_pay)}</td>
                    <td className="py-2 px-2 text-center">
                      <button onClick={() => setEditing(r)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit record">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !filtered.length && <p className="text-sm text-muted-foreground text-center py-8">No matching records.</p>}
        </div>
      </div>

      {editing && <EditSummaryRow record={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </div>
  );
}
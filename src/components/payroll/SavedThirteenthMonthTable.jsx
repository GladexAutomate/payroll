import { Trash2, FileText, CheckCircle2, Send, BadgeCheck } from 'lucide-react';
import { fmtDate } from '@/lib/dateFormat';

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

// Read-only list of approved/saved 13th month pay records.
export default function SavedThirteenthMonthTable({ records, loading, onDelete, onView, onRelease }) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="bg-card rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">
        No saved 13th month pay records yet. Compute, review a record, then approve &amp; save it here.
      </div>
    );
  }

  const total = records.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left py-3 px-4 font-medium">Employee</th>
              <th className="text-left py-3 px-4 font-medium">Year</th>
              <th className="text-right py-3 px-4 font-medium">Monthly Basic</th>
              <th className="text-right py-3 px-4 font-medium">Months</th>
              <th className="text-right py-3 px-4 font-medium">13th Month Pay</th>
              <th className="text-left py-3 px-4 font-medium">Status</th>
              <th className="text-left py-3 px-4 font-medium">Approved</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4">
                  <p className="font-medium">{r.employee_name}</p>
                  <p className="text-xs text-muted-foreground">{r.employee_code}</p>
                </td>
                <td className="py-3 px-4">{r.year}</td>
                <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{fmt(r.basic_salary)}</td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {r.months_worked}
                  {r.is_edited && <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium px-1.5 py-0.5">edited</span>}
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-semibold text-primary">{fmt(r.amount)}</td>
                <td className="py-3 px-4">
                  {r.release_status === 'released' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2 py-0.5">
                      <BadgeCheck className="w-3.5 h-3.5" /> Released
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium px-2 py-0.5">
                      Ready to Release
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" />{fmtDate(r.approved_date)}</span>
                  <span className="block">{r.approved_by}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    {r.release_status !== 'released' && (
                      <button onClick={() => onRelease?.(r)} className="p-1.5 rounded hover:bg-green-50 text-green-600 hover:text-green-700" title="Mark as released"><Send className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => onView?.(r)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="View payslip"><FileText className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onDelete?.(r)} className="p-1.5 rounded hover:bg-red-50 text-red-600 hover:text-red-700" title="Delete saved record"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 border-t-2 border-border font-semibold">
              <td className="py-3 px-4">Total ({records.length})</td>
              <td className="py-3 px-4" colSpan={3} />
              <td className="py-3 px-4 text-right tabular-nums text-primary">{fmt(total)}</td>
              <td className="py-3 px-4" colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
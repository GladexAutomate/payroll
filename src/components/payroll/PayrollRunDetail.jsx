import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import PayslipDocument from '@/components/payroll/PayslipDocument';

export default function PayrollRunDetail({ run, onClose }) {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [recs, emps] = await Promise.all([
        base44.entities.PayrollRecord.filter({ payroll_run_id: run.id }),
        base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000)
      ]);
      setRecords(recs);
      setEmployees(emps);
      setLoading(false);
    };
    load();
  }, [run.id]);

  const empMap = employees.reduce((m, e) => ({ ...m, [e.id]: e, [e.airtable_record_id]: e }), {});
  const activeRecords = records.filter(record => !record.is_held);
  const heldCount = records.length - activeRecords.length;
  const totals = activeRecords.reduce((sum, record) => ({
    gross: sum.gross + Number(record.gross_pay || 0),
    deductions: sum.deductions + Number(record.total_deductions || 0),
    net: sum.net + Number(record.net_pay || 0),
  }), { gross: 0, deductions: 0, net: 0 });
  const fmt = (n) => n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';

  const toggleHold = async (record) => {
    const nextValue = !record.is_held;
    const updatedRecords = records.map(item => item.id === record.id ? { ...item, is_held: nextValue } : item);
    setRecords(updatedRecords);

    const active = updatedRecords.filter(item => !item.is_held);
    const nextTotals = active.reduce((sum, item) => ({
      gross: sum.gross + Number(item.gross_pay || 0),
      deductions: sum.deductions + Number(item.total_deductions || 0),
      net: sum.net + Number(item.net_pay || 0),
    }), { gross: 0, deductions: 0, net: 0 });

    await base44.entities.PayrollRecord.update(record.id, { is_held: nextValue });
    await base44.entities.PayrollRun.update(run.id, {
      total_gross: nextTotals.gross,
      total_deductions: nextTotals.deductions,
      total_net: nextTotals.net,
      employee_count: active.length,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-20 bg-card border-b border-border shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-lg">{run.period_label}</h2>
            <p className="text-xs text-muted-foreground">{run.period_start} → {run.period_end}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={run.status} />
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
          </div>
        </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Employees</p>
            <p className="text-2xl font-bold mt-1">{activeRecords.length}</p>
            {heldCount > 0 && <p className="text-[10px] text-orange-600 mt-1">{heldCount} on hold</p>}
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Gross</p>
            <p className="text-2xl font-bold mt-1">{fmt(totals.gross)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Deductions</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{fmt(totals.deductions)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Net Pay</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{fmt(totals.net)}</p>
          </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="p-6">
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-xs">Hold</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Employee</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Basic</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Hours</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">OT Pay</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Gross</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">SSS</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">PhilHealth</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Pag-IBIG</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Tax</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Net Pay</th>
                    <th className="py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(rec => {
                    const emp = empMap[rec.employee_id];
                    return (
                      <tr key={rec.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${rec.is_held ? 'bg-orange-50/50 text-muted-foreground' : ''}`}>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!rec.is_held}
                            onChange={() => toggleHold(rec)}
                            className="h-4 w-4 rounded border-input accent-orange-500"
                            title="Put salary on hold"
                          />
                        </td>
                        <td className="py-3 px-3 font-medium">
                          {rec.employee_name || emp?.full_name || emp?.fields?.['Full Name'] || rec.employee_id}
                          {rec.is_held && <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">On hold</span>}
                          {rec.employee_code && <p className="text-[10px] text-muted-foreground">{rec.employee_code}</p>}
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground text-xs">{fmt(rec.basic_salary)}</td>
                        <td className="py-3 px-3 text-right text-xs">{rec.total_hours ?? rec.days_worked}</td>
                        <td className="py-3 px-3 text-right text-xs">{fmt(rec.overtime_pay)}</td>
                        <td className="py-3 px-3 text-right font-medium">{fmt(rec.gross_pay)}</td>
                        <td className="py-3 px-3 text-right text-xs text-red-600">{fmt(rec.sss_employee)}</td>
                        <td className="py-3 px-3 text-right text-xs text-red-600">{fmt(rec.philhealth_employee)}</td>
                        <td className="py-3 px-3 text-right text-xs text-red-600">{fmt(rec.pagibig_employee)}</td>
                        <td className="py-3 px-3 text-right text-xs text-red-600">{fmt(rec.withholding_tax)}</td>
                        <td className="py-3 px-3 text-right font-bold text-green-600">{fmt(rec.net_pay)}</td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => setSelectedRecord(rec)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedRecord && (
          <PayslipDocument record={selectedRecord} employee={employees.find(e => e.id === selectedRecord.employee_id || e.airtable_record_id === selectedRecord.airtable_record_id)} run={run} onClose={() => setSelectedRecord(null)} />
        )}
      </div>
    </div>
  );
}
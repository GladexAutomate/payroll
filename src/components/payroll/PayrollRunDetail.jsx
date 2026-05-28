import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';

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
  const fmt = (n) => n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 border-b border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Employees</p>
            <p className="text-2xl font-bold mt-1">{run.employee_count || records.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Gross</p>
            <p className="text-2xl font-bold mt-1">{fmt(run.total_gross)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Deductions</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{fmt(run.total_deductions)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Net Pay</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{fmt(run.total_net)}</p>
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
                      <tr key={rec.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 font-medium">
                          {rec.employee_name || emp?.full_name || emp?.fields?.['Full Name'] || rec.employee_id}
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
          <PayslipModal record={selectedRecord} employee={employees.find(e => e.id === selectedRecord.employee_id || e.airtable_record_id === selectedRecord.airtable_record_id)} run={run} onClose={() => setSelectedRecord(null)} />
        )}
      </div>
    </div>
  );
}

function PayslipModal({ record, employee, run, onClose }) {
  const fmt = (n) => n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00';

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div id="payslip-content">
          {/* Header */}
          <div className="text-center p-6 border-b" style={{ backgroundColor: 'hsl(222,47%,11%)' }}>
            <p className="text-white font-bold text-lg">PaySync PH</p>
            <p className="text-white/70 text-xs mt-0.5">Payslip — {run.period_label}</p>
          </div>

          <div className="p-6 space-y-4">
            {/* Employee Info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="font-bold text-base">{record.employee_name || employee?.full_name || employee?.fields?.['Full Name'] || '—'}</p>
              <p className="text-sm text-gray-500">{employee?.fields?.['Job Title'] || '—'}</p>
              <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-600">
                <span>ID: {record.employee_code || employee?.employee_code || employee?.fields?.['Employee Code ID']}</span>
                <span>Period: {run.period_label}</span>
              </div>
            </div>

            {/* Earnings */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Earnings</p>
              {[
                ['Regular Pay', record.regular_pay || record.basic_salary],
                ['Overtime Pay', record.overtime_pay],
                ['Allowances', record.allowances],
              ].filter(([, v]) => v > 0).map(([label, val]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium">{fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 text-sm font-semibold">
                <span>Gross Pay</span>
                <span className="text-green-600">{fmt(record.gross_pay)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Deductions</p>
              {[
                ['SSS Contribution', record.sss_employee],
                ['PhilHealth', record.philhealth_employee],
                ['Pag-IBIG', record.pagibig_employee],
                ['Withholding Tax', record.withholding_tax],
                ['Late Deduction', record.late_deduction],
                ['Absent Deduction', record.absent_deduction],
              ].filter(([, v]) => v > 0).map(([label, val]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                  <span className="text-gray-600">{label}</span>
                  <span className="text-red-600">{fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 text-sm font-semibold">
                <span>Total Deductions</span>
                <span className="text-red-600">{fmt(record.total_deductions)}</span>
              </div>
            </div>

            {/* Net Pay */}
            <div className="bg-green-50 rounded-xl p-4 flex justify-between items-center">
              <span className="font-bold text-base">NET PAY</span>
              <span className="font-bold text-2xl text-green-600">{fmt(record.net_pay)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}
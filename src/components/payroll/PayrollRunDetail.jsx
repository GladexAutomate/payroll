import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Printer, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';
import PayslipDocument from '@/components/payroll/PayslipDocument';
import { exportToCsv } from '@/lib/exportCsv';
import { fmtDate } from '@/lib/dateFormat';

export default function PayrollRunDetail({ run, onClose }) {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [search, setSearch] = useState('');
  const [brandings, setBrandings] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [recs, emps, brands] = await Promise.all([
        base44.entities.PayrollRecord.filter({ payroll_run_id: run.id }),
        base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000),
        base44.entities.BranchBranding.list('-updated_date', 1000),
      ]);
      setRecords(recs);
      setEmployees(emps);
      setBrandings(brands || []);
      setLoading(false);
    };
    load();
  }, [run.id]);

  const norm = (v) => String(v || '').trim().toLowerCase();
  const brandingForEmployee = (emp) => {
    const f = emp?.fields || {};
    const branch = norm(f.Branch || f.BRANCH || emp?.branch);
    const company = norm(f.Company || f.COMPANY || emp?.company);
    if (!branch) return null;
    return brandings.find(b => norm(b.branch_name) === branch && (!company || norm(b.company_name) === company))
      || brandings.find(b => norm(b.branch_name) === branch) || null;
  };

  const empMap = employees.reduce((m, e) => ({ ...m, [e.id]: e, [e.airtable_record_id]: e }), {});
  const activeRecords = records.filter(record => !record.is_held);
  const payrollHoursForRecord = (record) => {
    const daysWorked = Number(record.days_worked) || 0;
    return daysWorked > 0 ? daysWorked * 8 : Number(record.total_hours) || 0;
  };
  // Trust the reconciled (and possibly HR-edited) figures stored on the record.
  const grossForRecord = (record) => Number(record.gross_pay) || 0;
  const deductionsForRecord = (record) => Number(record.total_deductions) || 0;
  const netForRecord = (record) => Number(record.net_pay) != null
    ? Number(record.net_pay)
    : grossForRecord(record) - deductionsForRecord(record);
  const heldCount = records.length - activeRecords.length;
  const totals = activeRecords.reduce((sum, record) => ({
    gross: sum.gross + grossForRecord(record),
    deductions: sum.deductions + deductionsForRecord(record),
    net: sum.net + netForRecord(record),
  }), { gross: 0, deductions: 0, net: 0 });
  const fmt = (n) => n != null ? `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';
  const num = (n) => Number(n || 0).toFixed(2);

  const handleExport = () => {
    const columns = [
      { key: 'employee_code', label: 'Employee Code' },
      { key: (r) => recordName(r), label: 'Employee Name' },
      { key: 'is_held', label: 'On Hold', format: (v) => (v ? 'Yes' : 'No') },
      { key: 'basic_salary', label: 'Basic Salary', format: num },
      { key: 'hourly_rate', label: 'Hourly Rate', format: num },
      { key: (r) => payrollHoursForRecord(r), label: 'Hours', format: num },
      { key: 'days_worked', label: 'Days Worked', format: num },
      { key: 'days_absent', label: 'Days Absent', format: num },
      { key: 'regular_pay', label: 'Regular Pay', format: num },
      { key: 'overtime_pay', label: 'Overtime Pay', format: num },
      { key: 'holiday_pay', label: 'Holiday Pay', format: num },
      { key: 'allowances', label: 'Allowances', format: num },
      { key: 'gross_pay', label: 'Gross Pay', format: num },
      { key: 'sss_employee', label: 'SSS', format: num },
      { key: 'philhealth_employee', label: 'PhilHealth', format: num },
      { key: 'pagibig_employee', label: 'Pag-IBIG', format: num },
      { key: 'withholding_tax', label: 'Withholding Tax', format: num },
      { key: 'late_deduction', label: 'Late & Undertime', format: num },
      { key: 'absent_deduction', label: 'Absences', format: num },
      { key: 'other_deductions', label: 'Other Deductions', format: num },
      { key: 'total_deductions', label: 'Total Deductions', format: num },
      { key: 'net_pay', label: 'Net Pay', format: num },
    ];
    const safe = String(run.period_label || 'payroll').replace(/[^\w-]+/g, '_');
    exportToCsv(`payroll_${safe}`, columns, displayedRecords);
  };

  const recordName = (rec) => {
    const emp = empMap[rec.employee_id];
    return rec.employee_name || emp?.full_name || emp?.fields?.['Full Name'] || rec.employee_id || '';
  };
  const displayedRecords = records
    .filter(rec => recordName(rec).toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => recordName(a).localeCompare(recordName(b)));

  const toggleHold = async (record) => {
    const nextValue = !record.is_held;
    const updatedRecords = records.map(item => item.id === record.id ? { ...item, is_held: nextValue } : item);
    setRecords(updatedRecords);

    const active = updatedRecords.filter(item => !item.is_held);
    const nextTotals = active.reduce((sum, item) => ({
      gross: sum.gross + grossForRecord(item),
      deductions: sum.deductions + deductionsForRecord(item),
      net: sum.net + netForRecord(item),
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
            <p className="text-xs text-muted-foreground">{fmtDate(run.period_start)} → {fmtDate(run.period_end)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || records.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export
            </Button>
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
          <div className="relative mb-4 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search employee name..."
              className="pl-9"
            />
          </div>
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
                  {displayedRecords.map(rec => {
                    const emp = empMap[rec.employee_id];
                    const payrollHours = payrollHoursForRecord(rec);
                    const gross = grossForRecord(rec);
                    const net = netForRecord(rec);
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
                        <td className="py-3 px-3 text-right text-xs">{payrollHours}</td>
                        <td className="py-3 px-3 text-right text-xs">{fmt(rec.overtime_pay)}</td>
                        <td className="py-3 px-3 text-right font-medium">
                          {fmt(gross)}
                        </td>
                        <td className="py-3 px-3 text-right text-xs text-red-600">{fmt(rec.sss_employee)}</td>
                        <td className="py-3 px-3 text-right text-xs text-red-600">{fmt(rec.philhealth_employee)}</td>
                        <td className="py-3 px-3 text-right text-xs text-red-600">{fmt(rec.pagibig_employee)}</td>
                        <td className="py-3 px-3 text-right text-xs text-red-600">{fmt(rec.withholding_tax)}</td>
                        <td className="py-3 px-3 text-right font-bold text-green-600">{fmt(net)}</td>
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

        {selectedRecord && (() => {
          const emp = employees.find(e => e.id === selectedRecord.employee_id || e.airtable_record_id === selectedRecord.airtable_record_id);
          return <PayslipDocument record={selectedRecord} employee={emp} run={run} branding={brandingForEmployee(emp)} onClose={() => setSelectedRecord(null)} />;
        })()}
      </div>
    </div>
  );
}
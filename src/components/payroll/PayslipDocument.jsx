import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Row = ({ label, value, highlight, strong, bordered = true }) => (
  <div className={`flex items-center justify-between px-2.5 py-1.5 text-[11px] ${highlight ? 'bg-slate-50' : ''} ${bordered ? 'border-b border-slate-200' : ''}`}>
    <span className={`${highlight ? 'font-semibold text-slate-800' : 'text-slate-600'} italic`}>{label}</span>
    <span className={`${strong ? 'font-bold' : 'font-medium'} text-slate-900 tabular-nums`}>{value}</span>
  </div>
);

const SectionTitle = ({ children }) => (
  <div className="mt-4 mb-1.5 flex items-center gap-2">
    <span className="h-3.5 w-1 rounded-full bg-blue-600" />
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{children}</p>
  </div>
);

export default function PayslipDocument({ record, employee, run, onClose }) {
  const fields = employee?.fields || {};
  const company = fields['Company'] || fields['COMPANY'] || employee?.company || 'Company';
  const position = fields['Job Title'] || fields['Position'] || '—';
  const department = fields['Department'] || employee?.department || '—';
  const employeeName = record.employee_name || employee?.full_name || fields['Full Name'] || '—';
  const employeeCode = record.employee_code || employee?.employee_code || fields['Employee Code ID'] || '—';

  const regularPay = Number(record.regular_pay || record.basic_salary || 0);
  const allowances = Number(record.allowances || 0);
  const overtimePay = Number(record.overtime_pay || 0);
  const holidayPay = Number(record.holiday_pay || 0);
  const totalIncome = regularPay + allowances + overtimePay + holidayPay;

  const govDeductions = [
    ['SSS EE Contribution', record.sss_employee],
    ['Pag-IBIG EE Contribution', record.pagibig_employee],
    ['PhilHealth EE Contribution', record.philhealth_employee],
    ['Withholding Tax', record.withholding_tax],
    ['Late & Undertime', record.late_deduction],
  ];
  const compDeductions = [
    ['Absences', record.absent_deduction],
    ['Other Deductions', record.other_deductions],
  ];
  const totalGov = govDeductions.reduce((s, [, v]) => s + Number(v || 0), 0);
  const totalComp = compDeductions.reduce((s, [, v]) => s + Number(v || 0), 0);
  const overallDeductions = Number(record.total_deductions ?? (totalGov + totalComp));
  const netPay = Number(record.net_pay ?? (totalIncome - overallDeductions));

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border-t-4 border-blue-600">
        <div id="payslip-content" className="p-7">
          {/* Header */}
          <div className="flex items-start justify-between rounded-lg bg-gradient-to-r from-slate-900 to-blue-900 p-4 text-white shadow-md">
            <div>
              <p className="font-bold text-sm uppercase tracking-wide">{company}</p>
              <p className="text-[10px] text-blue-200 italic">Payslip — {run.period_label}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm">PaySync PH</p>
              <p className="text-[10px] text-blue-200">Official Payslip</p>
            </div>
          </div>

          {/* Employee + Salary details */}
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <table className="w-full text-[11px] border border-slate-300 border-collapse rounded overflow-hidden">
              <tbody>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600 w-2/5">Employee Name</td><td className="border border-slate-200 px-2 py-1 font-semibold uppercase text-slate-900">{employeeName}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Position</td><td className="border border-slate-200 px-2 py-1">{position}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Department</td><td className="border border-slate-200 px-2 py-1">{department}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Employee ID</td><td className="border border-slate-200 px-2 py-1">{employeeCode}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Cut-off Period</td><td className="border border-slate-200 px-2 py-1">{run.period_label}</td></tr>
              </tbody>
            </table>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-3.5 w-1 rounded-full bg-blue-600" />
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">I. Salary Details</p>
              </div>
              <table className="w-full text-[11px] border border-slate-300 border-collapse rounded overflow-hidden">
                <tbody>
                  <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600 w-1/2">Monthly Salary</td><td className="border border-slate-200 px-2 py-1 text-right tabular-nums">{fmt(record.basic_salary)}</td></tr>
                  <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Daily Rate</td><td className="border border-slate-200 px-2 py-1 text-right tabular-nums">{fmt((record.basic_salary || 0) / 26)}</td></tr>
                  <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Hourly Rate</td><td className="border border-slate-200 px-2 py-1 text-right tabular-nums">{fmt(record.hourly_rate)}</td></tr>
                  <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Total Hours Worked</td><td className="border border-slate-200 px-2 py-1 text-right tabular-nums">{record.total_hours ?? '—'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments and other incomes */}
          <SectionTitle>II. Payments and Other Incomes</SectionTitle>
          <div className="grid md:grid-cols-2 gap-3 items-start">
            <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
              <Row label="Regular Pay" value={fmt(regularPay)} />
              <Row label="Overtime Pay" value={fmt(overtimePay)} />
              <Row label="Holiday Pay" value={fmt(holidayPay)} />
              <Row label="Allowances" value={fmt(allowances)} />
              <Row label="Total" value={fmt(totalIncome)} highlight strong bordered={false} />
            </div>
            <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200 p-4 text-center shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Gross Amount</p>
              <p className="text-[10px] text-emerald-600 italic">(Before Deductions)</p>
              <p className="text-xl font-bold mt-2 tabular-nums text-emerald-700">{fmt(record.gross_pay ?? totalIncome)}</p>
            </div>
          </div>

          {/* Deductions */}
          <SectionTitle>III. Deductions</SectionTitle>
          <div className="grid md:grid-cols-2 gap-3 items-start">
            <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
              {govDeductions.map(([label, val]) => <Row key={label} label={label} value={fmt(val)} />)}
              <Row label="Total Gov't Deduction" value={fmt(totalGov)} highlight strong bordered={false} />
            </div>
            <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
              {compDeductions.map(([label, val]) => <Row key={label} label={label} value={fmt(val)} />)}
              <Row label="Total Comp. Deductions" value={fmt(totalComp)} highlight strong bordered={false} />
            </div>
          </div>
          <div className="rounded-lg bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 mt-3 flex items-center justify-between px-4 py-2.5 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wide text-red-800">Overall Deductions</span>
            <span className="font-bold text-red-600 tabular-nums">{fmt(overallDeductions)}</span>
          </div>

          {/* Net pay */}
          <SectionTitle>IV. Total Net Pay</SectionTitle>
          <div className="rounded-lg bg-gradient-to-r from-slate-900 to-blue-900 p-4 flex items-center justify-between shadow-md">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-blue-100">Total Salary</p>
              <p className="text-[10px] text-blue-300 italic">(To be received)</p>
            </div>
            <p className="text-2xl font-bold text-emerald-300 tabular-nums">{fmt(netPay)}</p>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t print:hidden">
          <Button variant="outline" className="flex-1" onClick={onClose}><X className="w-4 h-4 mr-1.5" /> Close</Button>
          <Button className="flex-1" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1.5" /> Print</Button>
        </div>
      </div>
    </div>
  );
}
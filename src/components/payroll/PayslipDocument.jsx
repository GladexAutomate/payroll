import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Row = ({ label, value, highlight, strong, bordered = true }) => (
  <div className={`flex items-center justify-between px-2.5 py-1.5 text-[11px] ${bordered ? 'border-b border-gray-200' : ''}`}>
    <span className={`${highlight ? 'font-semibold text-gray-800' : 'text-gray-600'} italic`}>{label}</span>
    <span className={`${strong ? 'font-bold' : 'font-medium'} text-gray-900 tabular-nums`}>{value}</span>
  </div>
);

const SectionTitle = ({ children }) => (
  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-700 mt-4 mb-1.5 underline">{children}</p>
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div id="payslip-content" className="p-7">
          {/* Header */}
          <div className="flex items-start justify-between border-2 border-gray-800 p-3">
            <div>
              <p className="font-bold text-sm uppercase">{company}</p>
              <p className="text-[10px] text-gray-500 italic">Payslip — {run.period_label}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm">PaySync PH</p>
            </div>
          </div>

          {/* Employee + Salary details */}
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <table className="w-full text-[11px] border border-gray-800 border-collapse">
              <tbody>
                <tr><td className="border border-gray-300 px-2 py-1 italic text-gray-600 w-2/5">Employee Name</td><td className="border border-gray-300 px-2 py-1 font-semibold uppercase">{employeeName}</td></tr>
                <tr><td className="border border-gray-300 px-2 py-1 italic text-gray-600">Position</td><td className="border border-gray-300 px-2 py-1">{position}</td></tr>
                <tr><td className="border border-gray-300 px-2 py-1 italic text-gray-600">Department</td><td className="border border-gray-300 px-2 py-1">{department}</td></tr>
                <tr><td className="border border-gray-300 px-2 py-1 italic text-gray-600">Employee ID</td><td className="border border-gray-300 px-2 py-1">{employeeCode}</td></tr>
                <tr><td className="border border-gray-300 px-2 py-1 italic text-gray-600">Cut-off Period</td><td className="border border-gray-300 px-2 py-1">{run.period_label}</td></tr>
              </tbody>
            </table>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-700 mb-1 underline">I. Salary Details</p>
              <table className="w-full text-[11px] border border-gray-800 border-collapse">
                <tbody>
                  <tr><td className="border border-gray-300 px-2 py-1 italic text-gray-600 w-1/2">Monthly Salary</td><td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{fmt(record.basic_salary)}</td></tr>
                  <tr><td className="border border-gray-300 px-2 py-1 italic text-gray-600">Daily Rate</td><td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{fmt((record.basic_salary || 0) / 26)}</td></tr>
                  <tr><td className="border border-gray-300 px-2 py-1 italic text-gray-600">Hourly Rate</td><td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{fmt(record.hourly_rate)}</td></tr>
                  <tr><td className="border border-gray-300 px-2 py-1 italic text-gray-600">Total Hours Worked</td><td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{record.total_hours ?? '—'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments and other incomes */}
          <SectionTitle>II. Payments and Other Incomes</SectionTitle>
          <div className="grid md:grid-cols-2 gap-3 items-start">
            <div className="border border-gray-800">
              <Row label="Regular Pay" value={fmt(regularPay)} />
              <Row label="Overtime Pay" value={fmt(overtimePay)} />
              <Row label="Holiday Pay" value={fmt(holidayPay)} />
              <Row label="Allowances" value={fmt(allowances)} />
              <Row label="Total" value={fmt(totalIncome)} highlight strong bordered={false} />
            </div>
            <div className="border border-gray-800 p-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-700">Gross Amount</p>
              <p className="text-[10px] text-gray-400 italic">(Before Deductions)</p>
              <p className="text-lg font-bold mt-2 tabular-nums">{fmt(record.gross_pay ?? totalIncome)}</p>
            </div>
          </div>

          {/* Deductions */}
          <SectionTitle>III. Deductions</SectionTitle>
          <div className="grid md:grid-cols-2 gap-3 items-start">
            <div className="border border-gray-800">
              {govDeductions.map(([label, val]) => <Row key={label} label={label} value={fmt(val)} />)}
              <Row label="Total Gov't Deduction" value={fmt(totalGov)} highlight strong bordered={false} />
            </div>
            <div className="border border-gray-800">
              {compDeductions.map(([label, val]) => <Row key={label} label={label} value={fmt(val)} />)}
              <Row label="Total Comp. Deductions" value={fmt(totalComp)} highlight strong bordered={false} />
            </div>
          </div>
          <div className="border border-gray-800 mt-3 flex items-center justify-between px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-700">Overall Deductions</span>
            <span className="font-bold text-red-600 tabular-nums">{fmt(overallDeductions)}</span>
          </div>

          {/* Net pay */}
          <SectionTitle>IV. Total Net Pay</SectionTitle>
          <div className="border-2 border-gray-800 p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-700">Total Salary</p>
              <p className="text-[10px] text-gray-400 italic">(To be received)</p>
            </div>
            <p className="text-2xl font-bold text-green-700 tabular-nums">{fmt(netPay)}</p>
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
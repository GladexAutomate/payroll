import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SectionTitle = ({ children, accent = '#2563eb' }) => (
  <div className="mt-4 mb-1.5 flex items-center gap-2">
    <span className="h-3.5 w-1 rounded-full" style={{ background: accent }} />
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{children}</p>
  </div>
);

// A payslip-style document for a single employee's 13th month pay.
export default function ThirteenthMonthPayslip({ employee, record, year, basis, branding, onClose }) {
  const brand = {
    primary: branding?.primary_color || '#0f172a',
    secondary: branding?.secondary_color || '#1e3a8a',
    accent: branding?.accent_color || '#2563eb',
    textOnPrimary: branding?.text_on_primary || '#ffffff',
    logo: branding?.logo_url || '',
  };
  const headerStyle = { background: `linear-gradient(to right, ${brand.primary}, ${brand.secondary})`, color: brand.textOnPrimary };
  const subTextStyle = { color: brand.textOnPrimary, opacity: 0.75 };

  const fields = employee?.fields || {};
  const company = fields['Company'] || fields['COMPANY'] || employee?.company || 'Company';
  const position = fields['Job Title'] || fields['Position'] || '—';
  const department = fields['Department'] || employee?.department || '—';
  const employeeName = record.employee_name || employee?.full_name || fields['Full Name'] || '—';
  const employeeCode = record.employee_code || employee?.employee_code || fields['Employee Code ID'] || '—';

  const basisLabel = basis === 'prorated' ? 'Prorated Full-Year' : 'Accrued (Earned So Far)';
  const payAmount = basis === 'prorated' ? record.prorated : record.accrued;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border-t-4" style={{ borderTopColor: brand.accent }}>
        <div id="payslip-content" className="relative p-7">
          {brand.logo && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <img src={brand.logo} alt="" className="w-2/3 max-w-md object-contain opacity-[0.06]" />
            </div>
          )}
          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between rounded-lg p-4 shadow-md" style={headerStyle}>
              <div className="flex items-center gap-3">
                {brand.logo && <img src={brand.logo} alt="logo" className="h-10 w-10 object-contain rounded bg-white/90 p-1" />}
                <div>
                  <p className="font-bold text-sm uppercase tracking-wide">{company}</p>
                  <p className="text-[10px] italic" style={subTextStyle}>13th Month Pay — {year}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">PaySync PH</p>
                <p className="text-[10px]" style={subTextStyle}>Per P.D. 851</p>
              </div>
            </div>

            {/* Employee details */}
            <SectionTitle accent={brand.accent}>I. Employee Information</SectionTitle>
            <table className="w-full text-[11px] border border-slate-300 border-collapse rounded overflow-hidden">
              <tbody>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600 w-2/5">Employee Name</td><td className="border border-slate-200 px-2 py-1 font-semibold uppercase text-slate-900">{employeeName}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Position</td><td className="border border-slate-200 px-2 py-1">{position}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Department</td><td className="border border-slate-200 px-2 py-1">{department}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Employee ID</td><td className="border border-slate-200 px-2 py-1">{employeeCode}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Year Covered</td><td className="border border-slate-200 px-2 py-1">{year}</td></tr>
              </tbody>
            </table>

            {/* Computation */}
            <SectionTitle accent={brand.accent}>II. Computation</SectionTitle>
            <table className="w-full text-[11px] border border-slate-300 border-collapse rounded overflow-hidden">
              <tbody>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600 w-3/5">Monthly Basic Salary</td><td className="border border-slate-200 px-2 py-1 text-right tabular-nums">{fmt(record.basic_salary)}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Months Active</td><td className="border border-slate-200 px-2 py-1 text-right tabular-nums">{record.months_worked}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Total Basic Salary Earned</td><td className="border border-slate-200 px-2 py-1 text-right tabular-nums">{fmt(record.basic_earned)}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Computation Basis</td><td className="border border-slate-200 px-2 py-1 text-right">{basisLabel}</td></tr>
                <tr><td className="border border-slate-200 bg-slate-50 px-2 py-1 italic text-slate-600">Divisor</td><td className="border border-slate-200 px-2 py-1 text-right tabular-nums">÷ 12</td></tr>
              </tbody>
            </table>

            {/* Total */}
            <SectionTitle accent={brand.accent}>III. 13th Month Pay</SectionTitle>
            <div className="rounded-lg p-4 flex items-center justify-between shadow-md" style={headerStyle}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: brand.textOnPrimary }}>13th Month Pay</p>
                <p className="text-[10px] italic" style={subTextStyle}>{basisLabel}</p>
              </div>
              <p className="text-2xl font-bold text-emerald-300 tabular-nums">{fmt(payAmount)}</p>
            </div>
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
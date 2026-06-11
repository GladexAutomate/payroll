import { FileText } from 'lucide-react';

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function ThirteenthMonthTable({ employees, totals, basis, onViewPayslip }) {
  // basis: 'accrued' (earned so far ÷ 12) or 'prorated' (full-year projection)
  const payField = basis === 'prorated' ? 'prorated' : 'accrued';
  const payTotal = basis === 'prorated' ? totals?.prorated : totals?.accrued;
  const payLabel = basis === 'prorated' ? 'Prorated 13th Month' : 'Accrued 13th Month';

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left py-3 px-4 font-medium">Employee</th>
              <th className="text-right py-3 px-4 font-medium">Monthly Basic</th>
              <th className="text-right py-3 px-4 font-medium">Months</th>
              <th className="text-right py-3 px-4 font-medium">Basic Salary Earned</th>
              <th className="text-right py-3 px-4 font-medium">{payLabel}</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.employee_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4">
                  <p className="font-medium">{e.employee_name}</p>
                  <p className="text-xs text-muted-foreground">{e.employee_code}</p>
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{fmt(e.basic_salary)}</td>
                <td className="py-3 px-4 text-right tabular-nums">
                  <span>{e.months_worked}</span>
                  {e.projected_months > 0 && (
                    <span
                      className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium px-1.5 py-0.5 align-middle"
                      title={`${e.projected_months} month(s) projected from plotted schedule (not yet reconciled)`}
                    >
                      +{e.projected_months} proj.
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(e.basic_earned)}</td>
                <td className="py-3 px-4 text-right tabular-nums font-semibold text-primary">{fmt(e[payField])}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onViewPayslip?.(e)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="View payslip"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="bg-muted/40 border-t-2 border-border font-semibold">
                <td className="py-3 px-4">Total ({employees.length})</td>
                <td className="py-3 px-4" />
                <td className="py-3 px-4" />
                <td className="py-3 px-4 text-right tabular-nums">{fmt(totals.basic_earned)}</td>
                <td className="py-3 px-4 text-right tabular-nums text-primary">{fmt(payTotal)}</td>
                <td className="py-3 px-4" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
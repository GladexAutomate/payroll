const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function ThirteenthMonthTable({ employees, totals, basis }) {
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
                <td className="py-3 px-4 text-right tabular-nums">{e.months_worked}</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(e.basic_earned)}</td>
                <td className="py-3 px-4 text-right tabular-nums font-semibold text-primary">{fmt(e[payField])}</td>
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
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
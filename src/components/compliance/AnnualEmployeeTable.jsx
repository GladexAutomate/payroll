const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function AnnualEmployeeTable({ employees, totals, mode = '1604c', onSelect }) {
  // mode: '1604c' = compensation summary, 'annualization' = focus on tax adjustment
  const isAnnualization = mode === 'annualization';

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="text-left py-3 px-4 font-medium">Employee</th>
              <th className="text-right py-3 px-4 font-medium">Gross</th>
              <th className="text-right py-3 px-4 font-medium">Contributions</th>
              <th className="text-right py-3 px-4 font-medium">Taxable</th>
              <th className="text-right py-3 px-4 font-medium">Tax Withheld</th>
              {isAnnualization && <th className="text-right py-3 px-4 font-medium">Annual Tax Due</th>}
              {isAnnualization && <th className="text-right py-3 px-4 font-medium">Refund / Collect</th>}
              {onSelect && <th className="py-3 px-4" />}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.employee_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4">
                  <p className="font-medium">{e.employee_name}</p>
                  <p className="text-xs text-muted-foreground">{e.employee_code}</p>
                </td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(e.gross)}</td>
                <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{fmt(e.total_contributions)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(e.taxable_income)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(e.tax_withheld)}</td>
                {isAnnualization && <td className="py-3 px-4 text-right tabular-nums">{fmt(e.annual_tax_due)}</td>}
                {isAnnualization && (
                  <td className={`py-3 px-4 text-right tabular-nums font-medium ${e.adjustment > 0 ? 'text-red-600' : e.adjustment < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {e.adjustment > 0 ? `Collect ${fmt(e.adjustment)}` : e.adjustment < 0 ? `Refund ${fmt(Math.abs(e.adjustment))}` : '—'}
                  </td>
                )}
                {onSelect && (
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => onSelect(e)} className="text-xs text-primary hover:underline font-medium">View 2316</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="bg-muted/40 border-t-2 border-border font-semibold">
                <td className="py-3 px-4">Total ({employees.length})</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(totals.gross)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt((totals.sss || 0) + (totals.philhealth || 0) + (totals.pagibig || 0))}</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(totals.taxable_income)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(totals.tax_withheld)}</td>
                {isAnnualization && <td className="py-3 px-4 text-right tabular-nums">{fmt(totals.annual_tax_due)}</td>}
                {isAnnualization && <td className="py-3 px-4 text-right tabular-nums">{fmt(totals.adjustment)}</td>}
                {onSelect && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
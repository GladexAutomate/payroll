import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Gift, Calculator, Loader2, Info } from 'lucide-react';
import ReportFilters from '@/components/compliance/ReportFilters';
import ThirteenthMonthTable from '@/components/payroll/ThirteenthMonthTable';

export default function ThirteenthMonth() {
  const [filters, setFilters] = useState({ year: new Date().getFullYear(), month: null, branch: null });
  const [basis, setBasis] = useState('accrued'); // 'accrued' | 'prorated'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('thirteenthMonthReport', { year: filters.year, branch: filters.branch });
    setData(res.data);
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">13th Month Pay</h1>
          <p className="text-sm text-muted-foreground">Computed per P.D. 851 — total basic salary earned in the year ÷ 12</p>
        </div>
      </div>

      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <p>
          <span className="font-medium text-foreground">Accrued</span> shows what each employee has earned so far this year ÷ 12.{' '}
          <span className="font-medium text-foreground">Prorated</span> projects the full-year amount based on the monthly basic salary and months active (for mid-year hires or resignations). Unpaid absences are excluded because no basic salary is earned for those days.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <ReportFilters {...filters} onChange={setFilters} />
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Computation</label>
          <select
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="accrued">Accrued so far</option>
            <option value="prorated">Prorated full-year</option>
          </select>
        </div>
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Calculator className="w-4 h-4 mr-1.5" />}
          Compute
        </Button>
      </div>

      {data && data.employees && (
        <ThirteenthMonthTable employees={data.employees} totals={data.totals} basis={basis} />
      )}
    </div>
  );
}
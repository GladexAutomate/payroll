import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2 } from 'lucide-react';
import ReportFilters from './ReportFilters';

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function Report1601C() {
  const [filters, setFilters] = useState({ year: new Date().getFullYear(), month: null, branch: null });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('taxComplianceReport', { report: '1601c', ...filters });
    setData(res.data);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Monthly remittance of income tax withheld from employee salaries. Pick a month for the BIR 1601-C period, or leave blank for the full year.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <ReportFilters {...filters} onChange={setFilters} showMonth />
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Calculator className="w-4 h-4 mr-1.5" />}
          Compute
        </Button>
      </div>

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Employees</p>
            <p className="text-2xl font-bold mt-1">{data.employee_count}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Gross</p>
            <p className="text-2xl font-bold mt-1">{fmt(data.total_gross)}</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-xs text-primary uppercase tracking-wide font-medium">Tax to Remit (1601-C)</p>
            <p className="text-2xl font-bold mt-1 text-primary">{fmt(data.total_withholding_tax)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2 } from 'lucide-react';
import ReportFilters from './ReportFilters';
import AnnualEmployeeTable from './AnnualEmployeeTable';
import Certificate2316 from './Certificate2316';

export default function AnnualReport({ reportType, mode, description, allowCertificate = false }) {
  const [filters, setFilters] = useState({ year: new Date().getFullYear(), month: null, branch: null });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const run = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('taxComplianceReport', { report: reportType, year: filters.year, branch: filters.branch });
    setData(res.data);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-end gap-3">
        <ReportFilters {...filters} onChange={setFilters} />
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Calculator className="w-4 h-4 mr-1.5" />}
          Compute
        </Button>
      </div>

      {data && data.employees && (
        <AnnualEmployeeTable
          employees={data.employees}
          totals={data.totals}
          mode={mode}
          onSelect={allowCertificate ? setSelected : undefined}
        />
      )}

      {selected && (
        <Certificate2316
          employee={selected}
          year={data.year}
          branch={data.branch}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
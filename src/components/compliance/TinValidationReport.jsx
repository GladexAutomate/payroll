import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import ReportFilters from './ReportFilters';

const STATUS = {
  valid: { label: 'Valid', cls: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  invalid: { label: 'Invalid', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  missing: { label: 'Missing', cls: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

export default function TinValidationReport() {
  const [filters, setFilters] = useState({ year: new Date().getFullYear(), month: null, branch: null });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('tinValidation', { branch: filters.branch });
    setData(res.data);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Checks each active employee's TIN format (9 or 12 digits). Flags missing or malformed numbers for follow-up. Official BIR registration must still be verified externally.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <ReportFilters {...filters} onChange={setFilters} />
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
          Check TINs
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {['valid', 'invalid', 'missing'].map((s) => {
              const Icon = STATUS[s].icon;
              return (
                <div key={s} className={`border rounded-xl p-4 ${STATUS[s].cls}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <p className="text-xs uppercase tracking-wide font-medium">{STATUS[s].label}</p>
                  </div>
                  <p className="text-2xl font-bold mt-1">{data.summary[s] || 0}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Employee</th>
                    <th className="text-left py-3 px-4 font-medium">TIN</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((e) => (
                    <tr key={e.employee_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium">{e.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{e.employee_code}</p>
                      </td>
                      <td className="py-3 px-4 tabular-nums">{e.tin || <span className="text-muted-foreground italic">none</span>}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS[e.status].cls}`}>
                          {STATUS[e.status].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
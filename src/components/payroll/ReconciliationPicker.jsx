import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { fmtDate, fmtDateRange } from '@/lib/dateFormat';

const fmtPeso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

// Reusable dropdown of completed reconciliations. Used by both "New Payroll Run"
// and "Rebuild" so the basis is always explicitly chosen.
export default function ReconciliationPicker({ value, onChange, onSelected }) {
  const [reconciledRuns, setReconciledRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.functions.invoke('reconcilePeriod', { action: 'list_runs' })
      .then(res => setReconciledRuns((res.data?.runs || []).filter(r => r.status === 'completed')))
      .finally(() => setLoading(false));
  }, []);

  const selected = reconciledRuns.find(r => r.id === value);

  const handleChange = (id) => {
    onChange(id);
    onSelected?.(reconciledRuns.find(r => r.id === id) || null);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Reconciled result*</label>
        {loading ? (
          <div className="mt-2 h-9 bg-muted rounded animate-pulse" />
        ) : reconciledRuns.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No completed reconciliations yet. Run a reconciliation first, then come back here.</p>
        ) : (
          <select
            value={value}
            onChange={e => handleChange(e.target.value)}
            required
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Choose a reconciled period...</option>
            {reconciledRuns.map(r => (
              <option key={r.id} value={r.id}>
                {fmtDateRange(r.period_start, r.period_end)} · {r.branch_filter || 'all'} · {r.employee_count || 0} emp
              </option>
            ))}
          </select>
        )}
      </div>

      {selected && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
          <p className="font-medium">{fmtDateRange(selected.period_start, selected.period_end)}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(selected.period_start)} → {fmtDate(selected.period_end)} · {selected.branch_filter || 'all'} branch</p>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-muted-foreground">{selected.employee_count || 0} employees</span>
            <span className="font-medium">{fmtPeso(selected.total_gross)} gross</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal wrapper used for the Rebuild flow.
export function RebuildPayrollModal({ run, onClose, onConfirm }) {
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Rebuild Payroll</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Choose which reconciled result to rebuild <span className="font-medium">{fmtDateRange(run.period_start, run.period_end)}</span> from.</p>
        </div>
        <div className="p-5 space-y-4">
          <ReconciliationPicker value={selectedId} onChange={setSelectedId} onSelected={setSelected} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" disabled={!selected} onClick={() => onConfirm(selected)}>Rebuild Run</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
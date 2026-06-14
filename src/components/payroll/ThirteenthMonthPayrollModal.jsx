import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

// Lets the user pick saved 13th month pay records (Ready to Release only) and
// generate a 13th month payroll run from them.
export default function ThirteenthMonthPayrollModal({ onClose, onGenerated }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState({}); // { recordId: true }
  const [payDate, setPayDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Only Ready to Release records are eligible — avoids re-generating released pay.
      const data = await base44.entities.ThirteenthMonthRecord.filter(
        { release_status: 'ready_to_release' }, '-created_date', 5000,
      );
      setRecords(data);
      setLoading(false);
    })();
  }, []);

  const allChecked = records.length > 0 && records.every(r => checked[r.id]);
  const selectedIds = useMemo(() => records.filter(r => checked[r.id]).map(r => r.id), [records, checked]);
  const selectedTotal = useMemo(
    () => records.filter(r => checked[r.id]).reduce((s, r) => s + Number(r.amount || 0), 0),
    [records, checked]
  );

  const toggleAll = () => {
    if (allChecked) { setChecked({}); return; }
    const next = {};
    records.forEach(r => { next[r.id] = true; });
    setChecked(next);
  };

  const toggleOne = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const handleGenerate = async () => {
    if (selectedIds.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      await base44.functions.invoke('generateThirteenthMonthPayroll', {
        record_ids: selectedIds,
        pay_date: payDate || undefined,
      });
      onGenerated();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to generate 13th month payroll.');
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Generate 13th Month Pay Payroll</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select saved records (Ready to Release only) to include in this run.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>
          )}

          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-9 bg-muted rounded animate-pulse" />)}</div>
          ) : records.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No "Ready to Release" 13th month pay records found. Compute and save records in the 13th Month Pay page first.
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2.5 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleAll}
                          className="h-4 w-4 rounded border-input accent-primary"
                          title={allChecked ? 'Uncheck all' : 'Check all'}
                        />
                      </th>
                      <th className="text-left py-2.5 px-3 font-medium">Employee</th>
                      <th className="text-left py-2.5 px-3 font-medium">Year</th>
                      <th className="text-right py-2.5 px-3 font-medium">13th Month Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr
                        key={r.id}
                        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggleOne(r.id)}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!checked[r.id]}
                            onChange={() => toggleOne(r.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-medium">{r.employee_name}</p>
                          <p className="text-xs text-muted-foreground">{r.employee_code}</p>
                        </td>
                        <td className="py-2.5 px-3">{r.year}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-primary">{fmt(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Pay Date</label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="mt-1 w-44" />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{selectedIds.length} selected</p>
              <p className="text-lg font-bold text-primary tabular-nums">{fmt(selectedTotal)}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={generating}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={selectedIds.length === 0 || generating}>
              {generating ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generating...</> : <>Generate Payroll</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
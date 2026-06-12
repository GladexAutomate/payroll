import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Save, Loader2, Calculator } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round = (n) => Math.round(Number(n || 0) * 100) / 100;

// Full computation breakdown for a single employee's 13th month pay.
// Monthly basic-earned figures are editable; totals recompute live.
// "Approve & Save" persists the (possibly edited) record to the 13th Month Pay table.
export default function ThirteenthMonthDetailModal({ record, year, basis, onClose, onSave }) {
  const basisLabel = basis === 'prorated' ? 'Prorated Full-Year' : 'Accrued (Earned So Far)';

  // Editable per-month amounts keyed by month index.
  const [months, setMonths] = useState(() => {
    const base = (record.monthly && record.monthly.length === 12)
      ? record.monthly
      : Array.from({ length: 12 }, (_, m) => ({ month: m, basic_earned: 0, projected: false }));
    return base.map(m => ({ ...m, basic_earned: round(m.basic_earned) }));
  });
  const [saving, setSaving] = useState(false);

  const setMonthValue = (idx, value) => {
    setMonths(prev => prev.map((m, i) => i === idx ? { ...m, basic_earned: value === '' ? 0 : Number(value) } : m));
  };

  // Live computed totals from the (edited) monthly amounts.
  const computed = useMemo(() => {
    const basicEarned = round(months.reduce((s, m) => s + Number(m.basic_earned || 0), 0));
    const monthsWorked = months.filter(m => Number(m.basic_earned || 0) > 0).length;
    const accrued = round(basicEarned / 12);
    const prorated = round((Number(record.basic_salary || 0) * monthsWorked) / 12);
    return { basicEarned, monthsWorked, accrued, prorated, amount: basis === 'prorated' ? prorated : accrued };
  }, [months, basis, record.basic_salary]);

  const isEdited = useMemo(() => {
    const orig = record.monthly || [];
    return months.some((m, i) => round(orig[i]?.basic_earned) !== round(m.basic_earned));
  }, [months, record.monthly]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      year,
      basis,
      employee_id: record.employee_id,
      employee_code: record.employee_code,
      employee_name: record.employee_name,
      basic_salary: round(record.basic_salary),
      months_worked: computed.monthsWorked,
      projected_months: months.filter(m => m.projected).length,
      basic_earned: computed.basicEarned,
      monthly: months,
      accrued: computed.accrued,
      prorated: computed.prorated,
      amount: computed.amount,
      is_edited: isEdited,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold">{record.employee_name}</h3>
            <p className="text-xs text-muted-foreground">{record.employee_code} · 13th Month Pay {year}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Monthly Basic Salary</p>
              <p className="font-semibold tabular-nums">{fmt(record.basic_salary)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Computation Basis</p>
              <p className="font-semibold">{basisLabel}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Basic salary earned per month (editable)</p>
            <div className="rounded-lg border border-border overflow-hidden">
              {months.map((m, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-1.5 border-b border-border/50 last:border-0">
                  <span className="w-24 text-sm">{MONTHS[m.month]}</span>
                  {m.projected && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium px-1.5 py-0.5">proj.</span>
                  )}
                  <Input
                    type="number"
                    step="0.01"
                    value={m.basic_earned === 0 ? '' : m.basic_earned}
                    placeholder="0.00"
                    onChange={(e) => setMonthValue(idx, e.target.value)}
                    className="ml-auto h-8 w-40 text-right tabular-nums"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Basic Salary Earned</span><span className="font-semibold tabular-nums">{fmt(computed.basicEarned)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Months with Earnings</span><span className="font-semibold tabular-nums">{computed.monthsWorked}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Divisor</span><span className="font-semibold tabular-nums">÷ 12</span></div>
            <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
              <span className="flex items-center gap-1.5 font-medium"><Calculator className="w-3.5 h-3.5 text-primary" /> 13th Month Pay ({basisLabel})</span>
              <span className="text-lg font-bold text-primary tabular-nums">{fmt(computed.amount)}</span>
            </div>
          </div>

          {isEdited && (
            <p className="text-xs text-amber-700">Monthly amounts were edited — the saved record will reflect your changes.</p>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Approve &amp; Save
          </Button>
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Numeric fields HR can adjust. Net pay is always recomputed from gross - total_deductions.
const EARNING_FIELDS = [
  ['regular_pay', 'Regular Pay'],
  ['overtime_pay', 'OT Pay'],
  ['holiday_pay', 'Holiday Pay'],
  ['leave_pay', 'Leave Pay'],
  ['night_diff_pay', 'Night Diff Pay'],
  ['allowances', 'Allowances'],
];
const DEDUCTION_FIELDS = [
  ['sss_employee', 'SSS'],
  ['philhealth_employee', 'PhilHealth'],
  ['pagibig_employee', 'Pag-IBIG'],
  ['withholding_tax', 'Withholding Tax'],
  ['lates_deduction', 'Lates'],
  ['undertime_deduction', 'Undertime'],
  ['absent_deduction', 'Absent'],
  ['other_deductions', 'ATD Charges'],
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function EditSummaryRow({ record, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    const base = {};
    [...EARNING_FIELDS, ...DEDUCTION_FIELDS].forEach(([key]) => { base[key] = record[key] ?? 0; });
    return base;
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const gross = EARNING_FIELDS.reduce((s, [k]) => s + num(form[k]), 0);
  const totalDeductions = DEDUCTION_FIELDS.reduce((s, [k]) => s + num(form[k]), 0);
  const netPay = gross - totalDeductions;
  const m = (n) => Math.round(n * 100) / 100;

  const handleSave = async () => {
    setSaving(true);
    let editorEmail = '';
    try { editorEmail = (await base44.auth.me())?.email || ''; } catch { /* ignore */ }
    const payload = {};
    [...EARNING_FIELDS, ...DEDUCTION_FIELDS].forEach(([key]) => { payload[key] = m(num(form[key])); });
    payload.gross = m(gross);
    payload.total_deductions = m(totalDeductions);
    payload.net_pay = m(netPay);
    payload.manually_edited = true;
    payload.edited_by = editorEmail;
    payload.edited_at = new Date().toISOString();
    await base44.entities.AttendancePaySummary.update(record.id, payload);
    onSaved({ ...record, ...payload });
    setSaving(false);
  };

  const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Edit payroll record</h3>
            <p className="text-xs text-muted-foreground">{record.employee_name || record.employee_code}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-auto flex-1 p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Earnings</p>
            <div className="grid grid-cols-2 gap-3">
              {EARNING_FIELDS.map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <Input type="number" step="0.01" value={form[key]} onChange={e => set(key, e.target.value)} className="mt-1" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Deductions</p>
            <div className="grid grid-cols-2 gap-3">
              {DEDUCTION_FIELDS.map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <Input type="number" step="0.01" value={form[key]} onChange={e => set(key, e.target.value)} className="mt-1" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Gross</p><p className="font-semibold">{fmt(gross)}</p></div>
            <div><p className="text-xs text-muted-foreground">Deductions</p><p className="font-semibold text-red-600">{fmt(totalDeductions)}</p></div>
            <div><p className="text-xs text-muted-foreground">Net Pay</p><p className="font-bold text-green-600">{fmt(netPay)}</p></div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
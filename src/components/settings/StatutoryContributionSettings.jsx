import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULTS = {
  key: 'default',
  philhealth_rate: 0.05,
  philhealth_salary_floor: 10000,
  philhealth_salary_ceiling: 100000,
  pagibig_rate: 0.02,
  pagibig_max_per_side: 100,
  sss_max_employee: 900,
  sss_max_employer: 1900,
};

const SECTIONS = [
  {
    title: 'PhilHealth',
    note: 'Premium split 50/50 between employee and employer.',
    fields: [
      { label: 'Rate (0.05 = 5%)', key: 'philhealth_rate', step: '0.001' },
      { label: 'Salary floor (₱)', key: 'philhealth_salary_floor', step: '100' },
      { label: 'Salary ceiling (₱)', key: 'philhealth_salary_ceiling', step: '100' },
    ],
  },
  {
    title: 'Pag-IBIG',
    note: 'Applied to monthly salary, capped per side.',
    fields: [
      { label: 'Rate (0.02 = 2%)', key: 'pagibig_rate', step: '0.001' },
      { label: 'Max per side (₱)', key: 'pagibig_max_per_side', step: '1' },
    ],
  },
  {
    title: 'SSS',
    note: 'Maximum monthly contribution caps from the SSS table.',
    fields: [
      { label: 'Max employee (₱)', key: 'sss_max_employee', step: '0.5' },
      { label: 'Max employer (₱)', key: 'sss_max_employer', step: '0.5' },
    ],
  },
];

export default function StatutoryContributionSettings() {
  const [policy, setPolicy] = useState(DEFAULTS);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const rows = await base44.entities.PayrollPolicy.filter({ key: 'default' });
    if (rows.length > 0) { setPolicy({ ...DEFAULTS, ...rows[0] }); setRecordId(rows[0].id); }
    setLoading(false);
  };

  const set = (k, v) => { setPolicy(p => ({ ...p, [k]: v })); setSaved(false); };

  const handleSave = async () => {
    setSaving(true);
    const { id, created_date, updated_date, created_by, ...data } = policy;
    if (recordId) await base44.entities.PayrollPolicy.update(recordId, data);
    else { const c = await base44.entities.PayrollPolicy.create({ ...data, key: 'default' }); setRecordId(c.id); }
    setSaving(false);
    setSaved(true);
  };

  if (loading) return <div className="bg-card border border-border rounded-xl p-5 h-40 animate-pulse" />;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-4.5 h-4.5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">Statutory Contributions</h3>
            <p className="text-xs text-muted-foreground">Editable — used in real payroll computation</p>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </Button>
      </div>

      <div className="p-5 space-y-6">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{section.title}</p>
            <p className="text-xs text-muted-foreground mb-3">{section.note}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {section.fields.map(f => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type="number"
                    step={f.step}
                    value={policy[f.key] ?? ''}
                    onChange={e => set(f.key, parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Withholding tax follows the 2026 monthly tax table (₱0 on taxable income of ₱20,833/month and below) and is not adjustable here.
        </p>
      </div>
    </div>
  );
}
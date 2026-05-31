import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { SlidersHorizontal, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULTS = {
  key: 'default',
  mandatory_break_minutes: 60,
  standard_work_hours: 8,
  grace_period_minutes: 15,
  deduct_undertime: true,
  ot_multiplier_regular: 1.25,
  ot_multiplier_rest_day: 1.3,
  ot_multiplier_rest_day_excess: 1.69,
  multiplier_regular_holiday: 2.0,
  ot_multiplier_regular_holiday: 2.6,
  multiplier_special_holiday: 1.3,
  ot_multiplier_special_holiday: 1.69,
  night_diff_enabled: true,
  night_diff_rate: 0.1,
  night_diff_start: '22:00',
  night_diff_end: '06:00',
  rest_day_work_requires_approval: true,
  thirteenth_month_enabled: true,
  working_days_divisor: 26,
};

const NUM = (label, key, step = '0.01') => ({ label, key, step, type: 'number' });

const SECTIONS = [
  {
    title: 'Work Hours & Break',
    fields: [
      NUM('Mandatory break (mins)', 'mandatory_break_minutes', '1'),
      NUM('Standard work hours/day', 'standard_work_hours', '0.5'),
      NUM('Grace period (mins)', 'grace_period_minutes', '1'),
      NUM('Daily rate divisor (days/mo)', 'working_days_divisor', '1'),
    ],
  },
  {
    title: 'Overtime Multipliers',
    fields: [
      NUM('Regular OT', 'ot_multiplier_regular'),
      NUM('Rest day work', 'ot_multiplier_rest_day'),
      NUM('Rest day OT (excess)', 'ot_multiplier_rest_day_excess'),
      NUM('Regular holiday work', 'multiplier_regular_holiday'),
      NUM('Regular holiday OT', 'ot_multiplier_regular_holiday'),
      NUM('Special holiday work', 'multiplier_special_holiday'),
      NUM('Special holiday OT', 'ot_multiplier_special_holiday'),
    ],
  },
  {
    title: 'Night Differential',
    fields: [
      NUM('Night diff rate (0.10 = 10%)', 'night_diff_rate'),
      { label: 'Window start', key: 'night_diff_start', type: 'time' },
      { label: 'Window end', key: 'night_diff_end', type: 'time' },
    ],
  },
];

const TOGGLES = [
  ['deduct_undertime', 'Deduct undertime / early-out'],
  ['night_diff_enabled', 'Apply night differential'],
  ['rest_day_work_requires_approval', 'Rest-day work requires approved OT request'],
  ['thirteenth_month_enabled', 'Accrue 13th month pay per period'],
];

export default function PayrollRulesSettings() {
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
          <SlidersHorizontal className="w-4.5 h-4.5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">Payroll Rules</h3>
            <p className="text-xs text-muted-foreground">Editable — adjust when DOLE policies change</p>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </Button>
      </div>

      <div className="p-5 space-y-6">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{section.title}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {section.fields.map(f => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type={f.type}
                    step={f.step}
                    value={policy[f.key] ?? ''}
                    onChange={e => set(f.key, f.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Toggles</p>
          <div className="space-y-2">
            {TOGGLES.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" checked={!!policy[key]} onChange={e => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
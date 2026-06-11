import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getScheduleDays, SCHEDULE_TYPES, parseShiftValue } from './scheduleUtils';

const fmtCustom = (c) => c && c.includes('-') ? c.split('-').map(p => p.length === 4 ? `${p.slice(0,2)}:${p.slice(2)}` : p).join('-') : c;

// Build the ordered list of card options a user can cycle through for a cell.
const buildCardOptions = (shiftTemplates) => {
  const options = [{ value: 'none', label: 'No Sched', color: null, className: 'bg-slate-100 text-slate-600 border-slate-300' }];
  shiftTemplates.forEach(t => options.push({
    value: `shift:${t.id}`,
    label: `${t.name} (${t.start_time}-${t.end_time})`,
    color: t.card_color || '#6366f1',
    className: 'text-white',
  }));
  ['off', 'wfh', 'paid_vl', 'sick', 'unpaid_vl', 'emergency', 'maternity', 'paternity'].forEach(key => {
    const c = SCHEDULE_TYPES[key];
    options.push({ value: key, label: c.short, color: null, className: c.className });
  });
  return options;
};

const labelFor = (type, shiftTemplates) => {
  if (type && type.startsWith('shift:')) {
    const { baseType, mode, custom } = parseShiftValue(type);
    const id = baseType.slice('shift:'.length);
    const t = shiftTemplates.find(s => String(s.id) === String(id));
    const base = t ? `${t.name} (${t.start_time}-${t.end_time})` : 'Shift';
    if (mode === 'wfh') return `${base} · WFH`;
    if (mode === 'custom') return `${base} · ${fmtCustom(custom)}`;
    return base;
  }
  return SCHEDULE_TYPES[type]?.short || 'No Sched';
};

export default function EmployeeScheduleEditModal({ employee, periodStart, periodEnd, baseAssignments, shiftTemplates, onClose, onSave }) {
  const days = useMemo(() => getScheduleDays(periodStart, periodEnd), [periodStart, periodEnd]);
  const options = useMemo(() => buildCardOptions(shiftTemplates), [shiftTemplates]);
  const original = baseAssignments?.[employee.id] || {};
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const currentType = (date) => (draft[date] !== undefined ? draft[date] : (original[date] || 'none'));

  const cycle = (date) => {
    const cur = currentType(date);
    const idx = options.findIndex(o => o.value === cur);
    const next = options[(idx + 1) % options.length].value;
    setDraft(prev => ({ ...prev, [date]: next }));
  };

  const optionFor = (type) => {
    if (type && type.startsWith('shift:')) {
      const { baseType } = parseShiftValue(type);
      return options.find(o => o.value === baseType) || options.find(o => o.value === 'none');
    }
    return options.find(o => o.value === type) || options.find(o => o.value === 'none');
  };

  const changedCount = Object.entries(draft).filter(([date, val]) => val !== (original[date] || 'none')).length;

  const handleSave = async () => {
    setSaving(true);
    const edits = Object.entries(draft)
      .filter(([date, val]) => val !== (original[date] || 'none'))
      .map(([date, val]) => ({
        date,
        newValue: val,
        oldValue: original[date] || 'none',
        newLabel: labelFor(val, shiftTemplates),
        oldLabel: labelFor(original[date] || 'none', shiftTemplates),
      }));
    await onSave(employee, edits);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Edit Schedule</h3>
            <p className="text-xs text-muted-foreground mt-0.5 uppercase">{employee.name}</p>
            <p className="text-[11px] text-muted-foreground">{periodStart} → {periodEnd}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="mb-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Available cards</p>
            <div className="flex flex-wrap gap-1.5">
              {options.filter(o => o.value !== 'none').map(o => (
                <span
                  key={o.value}
                  className={`rounded px-2 py-1 text-[11px] font-semibold border ${o.color ? 'text-white' : o.className}`}
                  style={o.color ? { backgroundColor: o.color, borderColor: o.color } : undefined}
                >
                  {o.label}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Click a day to cycle through schedule cards (shift → OFF → leave → No Sched).</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {days.map(day => {
              const date = format(day, 'yyyy-MM-dd');
              const type = currentType(date);
              const opt = optionFor(type);
              const changed = (draft[date] !== undefined) && draft[date] !== (original[date] || 'none');
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => cycle(date)}
                  className={`relative rounded-lg border px-2 py-2 text-left transition hover:scale-[1.02] ${opt.color ? '' : opt.className}`}
                  style={opt.color ? { backgroundColor: opt.color, borderColor: opt.color, color: '#fff' } : undefined}
                >
                  {changed && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-300 ring-1 ring-white" />}
                  <div className="text-[11px] font-semibold opacity-90">{format(day, 'MM-dd EEE')}</div>
                  <div className="text-[11px] font-bold leading-tight mt-0.5">{labelFor(type, shiftTemplates)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{changedCount} day(s) changed</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || changedCount === 0}>
              <Save className={`w-4 h-4 mr-1.5 ${saving ? 'animate-pulse' : ''}`} /> {saving ? 'Saving...' : 'Save Schedule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
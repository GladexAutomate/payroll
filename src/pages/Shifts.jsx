import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadShifts(); }, []);

  const loadShifts = async () => {
    setLoading(true);
    const data = await base44.entities.ShiftTemplate.list();
    setShifts(data);
    setLoading(false);
  };

  const handleSave = async (data) => {
    if (editing) await base44.entities.ShiftTemplate.update(editing.id, data);
    else await base44.entities.ShiftTemplate.create(data);
    setShowForm(false); setEditing(null); loadShifts();
  };

  const handleDelete = async (id) => {
    await base44.entities.ShiftTemplate.delete(id);
    loadShifts();
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Shift
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-36 bg-card border border-border rounded-xl animate-pulse" />)
        ) : shifts.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-muted-foreground">No shift templates yet.</div>
        ) : shifts.map(shift => (
          <div key={shift.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${shift.card_color || '#6366f1'}1a` }}>
                  <Clock className="w-5 h-5" style={{ color: shift.card_color || '#6366f1' }} />
                </div>
                <div>
                  <p className="font-semibold">{shift.name}</p>
                  {shift.is_night_shift && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Night Shift</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(shift); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(shift.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Start Time</span><span className="font-medium">{shift.start_time}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">End Time</span><span className="font-medium">{shift.end_time}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Break</span><span>{shift.break_minutes || 60} min</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Grace Period</span><span>{shift.grace_period_minutes || 15} min</span></div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <ShiftForm shift={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

function ShiftForm({ shift, onSave, onClose }) {
  const [form, setForm] = useState({
    name: shift?.name || '',
    start_time: shift?.start_time || '08:00',
    end_time: shift?.end_time || '17:00',
    break_minutes: shift?.break_minutes || 60,
    grace_period_minutes: shift?.grace_period_minutes || 15,
    is_night_shift: shift?.is_night_shift || false,
    card_color: shift?.card_color || '#6366f1',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const COLORS = ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b'];
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">{shift ? 'Edit' : 'Add'} Shift Template</h3>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="p-5 space-y-3">
          <div><Label>Shift Name*</Label><Input value={form.name} onChange={e => set('name', e.target.value)} required className="mt-1" placeholder="e.g. Morning Shift" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Time*</Label><Input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} required className="mt-1" /></div>
            <div><Label>End Time*</Label><Input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} required className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Break (min)</Label><Input type="number" value={form.break_minutes} onChange={e => set('break_minutes', parseInt(e.target.value))} className="mt-1" /></div>
            <div><Label>Grace Period (min)</Label><Input type="number" value={form.grace_period_minutes} onChange={e => set('grace_period_minutes', parseInt(e.target.value))} className="mt-1" /></div>
          </div>
          <div>
            <Label>Card Color</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('card_color', c)}
                  className={`w-7 h-7 rounded-full border-2 transition ${form.card_color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
            <input type="checkbox" checked={form.is_night_shift} onChange={e => set('is_night_shift', e.target.checked)} /> Night shift (crosses midnight)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
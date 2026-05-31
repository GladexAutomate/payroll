import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Building2, Calendar } from 'lucide-react';
import WebhookSettings from '@/components/schedule/WebhookSettings';
import PayrollRulesSettings from '@/components/settings/PayrollRulesSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Settings() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', name: '', type: 'regular' });

  useEffect(() => { loadHolidays(); }, []);

  const loadHolidays = async () => {
    setLoading(true);
    const data = await base44.entities.HolidayCalendar.list('date', 100);
    setHolidays(data);
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    await base44.entities.HolidayCalendar.create(form);
    setShowForm(false);
    setForm({ date: '', name: '', type: 'regular' });
    loadHolidays();
  };

  const handleDelete = async (id) => {
    await base44.entities.HolidayCalendar.delete(id);
    loadHolidays();
  };

  const seedPHHolidays = async () => {
    const ph2026 = [
      { date: '2026-01-01', name: "New Year's Day", type: 'regular' },
      { date: '2026-01-26', name: "Chinese New Year", type: 'special_non_working' },
      { date: '2026-02-25', name: "EDSA People Power Revolution Anniversary", type: 'special_non_working' },
      { date: '2026-04-02', name: "Maundy Thursday", type: 'regular' },
      { date: '2026-04-03', name: "Good Friday", type: 'regular' },
      { date: '2026-04-04', name: "Black Saturday", type: 'special_non_working' },
      { date: '2026-04-09', name: "Araw ng Kagitingan", type: 'regular' },
      { date: '2026-05-01', name: "Labor Day", type: 'regular' },
      { date: '2026-06-12', name: "Independence Day", type: 'regular' },
      { date: '2026-08-21', name: "Ninoy Aquino Day", type: 'special_non_working' },
      { date: '2026-08-31', name: "National Heroes Day", type: 'regular' },
      { date: '2026-11-01', name: "All Saints Day", type: 'special_non_working' },
      { date: '2026-11-02', name: "All Souls Day", type: 'special_non_working' },
      { date: '2026-11-30', name: "Bonifacio Day", type: 'regular' },
      { date: '2026-12-08', name: "Feast of the Immaculate Conception", type: 'special_non_working' },
      { date: '2026-12-24', name: "Christmas Eve", type: 'special_non_working' },
      { date: '2026-12-25', name: "Christmas Day", type: 'regular' },
      { date: '2026-12-30', name: "Rizal Day", type: 'regular' },
      { date: '2026-12-31', name: "Last Day of the Year", type: 'special_non_working' },
    ];
    await base44.entities.HolidayCalendar.bulkCreate(ph2026);
    loadHolidays();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <WebhookSettings />

      <PayrollRulesSettings />

      {/* Holiday Calendar */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4.5 h-4.5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">Philippine Holiday Calendar</h3>
              <p className="text-xs text-muted-foreground">Used in payroll computations</p>
            </div>
          </div>
          <div className="flex gap-2">
            {holidays.length === 0 && (
              <Button variant="outline" size="sm" onClick={seedPHHolidays}>
                Seed 2026 PH Holidays
              </Button>
            )}
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="p-5 border-b border-border bg-muted/30">
            <div className="flex flex-wrap gap-3 items-end">
              <div><Label className="text-xs">Date*</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required className="mt-1 w-36" /></div>
              <div><Label className="text-xs">Holiday Name*</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className="mt-1 w-56" /></div>
              <div>
                <Label className="text-xs">Type</Label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="mt-1 border border-border rounded-lg px-2.5 py-2 text-sm bg-card block">
                  <option value="regular">Regular Holiday</option>
                  <option value="special_non_working">Special Non-Working</option>
                  <option value="local">Local Holiday</option>
                </select>
              </div>
              <Button type="submit" size="sm">Add</Button>
            </div>
          </form>
        )}

        <div className="divide-y divide-border">
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} className="h-11 bg-muted animate-pulse mx-4 my-2 rounded" />)
          ) : holidays.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No holidays added. Click "Seed 2026 PH Holidays" to add all Philippine holidays.
            </div>
          ) : holidays.map(h => (
            <div key={h.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-24">{h.date}</span>
                <span className="text-sm font-medium">{h.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${h.type === 'regular' ? 'bg-red-50 text-red-700' : h.type === 'special_non_working' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                  {h.type === 'regular' ? 'Regular' : h.type === 'special_non_working' ? 'Special' : 'Local'}
                </span>
              </div>
              <button onClick={() => handleDelete(h.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Statutory contribution rules (reference) */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" /> Statutory Contributions (reference)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            ['SSS', 'Based on 2024 table (max ₱900/mo EE)', 'bg-blue-50 text-blue-800'],
            ['PhilHealth', '5% of salary, split 50/50, max ₱100k bracket', 'bg-green-50 text-green-800'],
            ['Pag-IBIG', '2% employee + 2% employer (max ₱100/side)', 'bg-orange-50 text-orange-800'],
            ['Withholding Tax', 'TRAIN Law 2024 — 0% below ₱250k/yr', 'bg-purple-50 text-purple-800'],
          ].map(([title, desc, color]) => (
            <div key={title} className={`rounded-xl p-3 ${color}`}>
              <p className="font-semibold text-xs">{title}</p>
              <p className="text-xs mt-0.5 opacity-80">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
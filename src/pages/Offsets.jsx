import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';
import { getAirtableEmployeeName, isActiveAirtableEmployee } from '@/utils/airtableEmployee';
import OTBankTable from '@/components/offset/OTBankTable';

export default function Offsets() {
  const [requests, setRequests] = useState([]);
  const [overtime, setOvertime] = useState([]);
  const [offsets, setOffsets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [offs, ot, emps] = await Promise.all([
      base44.entities.OffsetRequest.list('-created_date', 200),
      base44.entities.OvertimeRequest.filter({ status: 'approved' }, '-date', 1000),
      base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000),
    ]);
    const activeEmps = emps
      .filter(isActiveAirtableEmployee)
      .sort((a, b) => getAirtableEmployeeName(a).localeCompare(getAirtableEmployeeName(b)));
    setOffsets(offs);
    setRequests(offs);
    setOvertime(ot);
    setEmployees(activeEmps);
    setLoading(false);
  };

  const empMap = employees.reduce((m, e) => ({ ...m, [e.id]: e }), {});
  const filtered = requests.filter(r => filterStatus === 'all' || r.status === filterStatus);

  const handleApprove = async (req) => {
    await base44.entities.OffsetRequest.update(req.id, {
      status: 'approved',
      approved_date: new Date().toISOString(),
    });
    loadData();
  };

  const handleReject = async (id) => {
    await base44.entities.OffsetRequest.update(id, { status: 'rejected' });
    loadData();
  };

  return (
    <div className="space-y-6">
      <OTBankTable overtime={overtime} offsets={offsets} empMap={empMap} loading={loading} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {['all', 'pending', 'approved', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors capitalize ${filterStatus === s ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> File Offset
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Offset Date</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Offset Hours</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Reason</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => <tr key={i} className="border-b border-border/50">{[...Array(6)].map((_, j) => <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No {filterStatus === 'all' ? '' : filterStatus} offset requests.</td></tr>
              ) : filtered.map(req => {
                const emp = empMap[req.employee_id];
                return (
                  <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium">{emp ? getAirtableEmployeeName(emp) : req.employee_name || req.employee_id}</td>
                    <td className="py-3.5 px-4">{req.offset_date}</td>
                    <td className="py-3.5 px-4 text-right font-medium">{req.offset_hours}h</td>
                    <td className="py-3.5 px-4 text-muted-foreground max-w-[200px] truncate">{req.reason || '—'}</td>
                    <td className="py-3.5 px-4"><StatusBadge status={req.status} /></td>
                    <td className="py-3.5 px-4">
                      {req.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleApprove(req)} className="p-1.5 rounded hover:bg-green-50 text-green-600">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleReject(req.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <OffsetForm employees={employees} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadData(); }} />
      )}
    </div>
  );
}

function OffsetForm({ employees, onClose, onSaved }) {
  const [form, setForm] = useState({ employee_id: '', offset_date: '', offset_hours: 1, reason: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emp = employees.find(x => x.id === form.employee_id);
    await base44.entities.OffsetRequest.create({ ...form, employee_name: emp ? getAirtableEmployeeName(emp) : '' });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">File Offset Request</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Employee*</label>
            <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} required className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-card">
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{getAirtableEmployeeName(e)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-muted-foreground">Offset Date*</label><Input type="date" value={form.offset_date} onChange={e => set('offset_date', e.target.value)} required className="mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Offset Hours*</label><Input type="number" step="0.5" min="0.5" value={form.offset_hours} onChange={e => set('offset_hours', parseFloat(e.target.value))} required className="mt-1" /></div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">Uses banked approved OT. On the offset date the employee works fewer hours but is still paid a full day. Hours are drawn from the employee's OT bank for the period.</p>
          <div><label className="text-xs font-medium text-muted-foreground">Reason</label><Input value={form.reason} onChange={e => set('reason', e.target.value)} className="mt-1" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Submit</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
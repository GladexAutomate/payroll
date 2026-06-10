import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';
import { useEmployeeScope } from '@/lib/useEmployeeScope';
import { useCurrentTier } from '@/hooks/useCurrentTier';
import { buildRequestorTierMap } from '@/lib/requestorTier';
import ApprovalChain from '@/components/approval/ApprovalChain';

export default function Leaves() {
  const { selfOnly, ownEmployeeId, isOwn, ownIds, loading: scopeLoading } = useEmployeeScope();
  const current = useCurrentTier();
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tierMap, setTierMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [reqs, emps] = await Promise.all([
      base44.entities.LeaveRequest.list('-created_date', 100),
      base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000)
    ]);
    setRequests(reqs);
    setEmployees(emps);
    setTierMap(await buildRequestorTierMap(emps));
    setLoading(false);
  };

  const empMap = employees.reduce((m, e) => ({ ...m, [e.id]: e, [e.airtable_record_id]: e }), {});
  const filtered = requests
    .filter(r => isOwn(r.employee_id))
    .filter(r => filterStatus === 'all' || r.status === filterStatus);

  // Persist a chain update and keep the legacy status in sync.
  const handleChainUpdate = async (req, patch) => {
    const update = { approval_chain: patch.approval_chain ?? req.approval_chain, chain_status: patch.chain_status };
    if (patch.fully_signed) { update.status = 'approved'; update.approved_date = new Date().toISOString(); }
    if (patch.rejected) update.status = 'rejected';
    await base44.entities.LeaveRequest.update(req.id, update);
    loadData();
  };

  return (
    <div className="space-y-5">
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
          <Plus className="w-4 h-4 mr-1.5" /> File Leave
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">From</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">To</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Days</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Reason</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Approval Chain</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => <tr key={i} className="border-b border-border/50">{[...Array(8)].map((_, j) => <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No {filterStatus === 'all' ? '' : filterStatus} leave requests.</td></tr>
              ) : filtered.map(req => {
                const emp = empMap[req.employee_id];
                return (
                  <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium">{emp ? (emp.full_name || emp.fields?.['Full Name'] || req.employee_id) : req.employee_id}</td>
                    <td className="py-3.5 px-4 capitalize text-muted-foreground">{req.leave_type?.replace('_', ' ')}</td>
                    <td className="py-3.5 px-4">{req.date_from}</td>
                    <td className="py-3.5 px-4">{req.date_to}</td>
                    <td className="py-3.5 px-4 text-right">{req.days_count}</td>
                    <td className="py-3.5 px-4 text-muted-foreground max-w-[200px] truncate">{req.reason || '—'}</td>
                    <td className="py-3.5 px-4"><StatusBadge status={req.status} /></td>
                    <td className="py-3.5 px-4 min-w-[260px]">
                      {!current.loading && (
                        <ApprovalChain
                          record={req}
                          requestorTier={tierMap[req.employee_id] || 'employees'}
                          current={current}
                          isOwnRecord={ownIds?.has(String(req.employee_id))}
                          onUpdate={(patch) => handleChainUpdate(req, patch)}
                        />
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
        <LeaveForm employees={employees} selfOnly={selfOnly} ownEmployeeId={ownEmployeeId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadData(); }} />
      )}
    </div>
  );
}

function LeaveForm({ employees, selfOnly, ownEmployeeId, onClose, onSaved }) {
  const [form, setForm] = useState({ employee_id: selfOnly ? ownEmployeeId : '', leave_type: 'vacation', date_from: '', date_to: '', reason: '', is_paid: true });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const days = form.date_from && form.date_to
    ? Math.ceil((new Date(form.date_to) - new Date(form.date_from)) / 86400000) + 1
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.LeaveRequest.create({ ...form, days_count: days, chain_status: 'awaiting_employee', approval_chain: [] });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">File Leave Request</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {!selfOnly && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Employee*</label>
              <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} required className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-card">
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.airtable_record_id}>{e.full_name || e.fields?.['Full Name'] || e.employee_code}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Leave Type</label>
            <select value={form.leave_type} onChange={e => set('leave_type', e.target.value)} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-card">
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="emergency">Emergency</option>
              <option value="maternity">Maternity</option>
              <option value="paternity">Paternity</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-muted-foreground">From*</label><Input type="date" value={form.date_from} onChange={e => set('date_from', e.target.value)} required className="mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">To*</label><Input type="date" value={form.date_to} onChange={e => set('date_to', e.target.value)} required className="mt-1" /></div>
          </div>
          {days > 0 && <p className="text-xs text-primary font-medium">{days} day(s)</p>}
          <div><label className="text-xs font-medium text-muted-foreground">Reason</label><Input value={form.reason} onChange={e => set('reason', e.target.value)} className="mt-1" /></div>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="is_paid" checked={form.is_paid} onChange={e => set('is_paid', e.target.checked)} />
            <label htmlFor="is_paid" className="text-sm">Paid leave</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
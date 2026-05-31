import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Send, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAirtableEmployeeName, isActiveAirtableEmployee } from '@/utils/airtableEmployee';
import DeductionForm from '@/components/deductions/DeductionForm';

const peso = (v) => `₱${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ATD_BADGE = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-50 text-red-600',
};

export default function Deductions() {
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('deduction');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [list, emps] = await Promise.all([
      base44.entities.EmployeeDeduction.list('-created_date', 500),
      base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000),
    ]);
    setItems(list);
    setEmployees(emps.filter(isActiveAirtableEmployee).sort((a, b) => getAirtableEmployeeName(a).localeCompare(getAirtableEmployeeName(b))));
    setLoading(false);
  };

  const empMap = employees.reduce((m, e) => ({ ...m, [e.id]: e }), {});
  const filtered = items.filter(i => i.kind === tab);

  const handleDelete = async (id) => {
    await base44.entities.EmployeeDeduction.delete(id);
    loadData();
  };

  const sendATD = async (item) => {
    await base44.entities.EmployeeDeduction.update(item.id, { atd_status: 'sent', atd_sent_date: new Date().toISOString() });
    loadData();
  };

  const approveATD = async (item) => {
    await base44.entities.EmployeeDeduction.update(item.id, { atd_status: 'active', atd_approved_date: new Date().toISOString() });
    loadData();
  };

  const cancelATD = async (item) => {
    await base44.entities.EmployeeDeduction.update(item.id, { atd_status: 'cancelled' });
    loadData();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[['deduction', 'Charges / ATD'], ['allowance', 'Allowances']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${tab === k ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> New {tab === 'allowance' ? 'Allowance' : 'Charge'}
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Label</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Per Cutoff</th>
                {tab === 'deduction' && <>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Progress</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Start</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">ATD</th>
                </>}
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => <tr key={i} className="border-b border-border/50">{[...Array(tab === 'deduction' ? 8 : 4)].map((_, j) => <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No {tab === 'allowance' ? 'allowances' : 'charges'} yet.</td></tr>
              ) : filtered.map(item => {
                const emp = empMap[item.employee_id];
                return (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium">{emp ? getAirtableEmployeeName(emp) : item.employee_name || item.employee_id}</td>
                    <td className="py-3.5 px-4">{item.label}</td>
                    <td className="py-3.5 px-4 text-right">{peso(item.amount_per_cutoff)}</td>
                    {tab === 'deduction' && <>
                      <td className="py-3.5 px-4 text-right">{item.recurring ? '—' : peso(item.total_amount)}</td>
                      <td className="py-3.5 px-4 text-center text-xs text-muted-foreground">{item.recurring ? 'Recurring' : `${item.cutoffs_paid || 0}/${item.total_cutoffs || '?'}`}</td>
                      <td className="py-3.5 px-4 text-xs">{item.start_date || '—'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ATD_BADGE[item.atd_status] || ATD_BADGE.draft}`}>{item.atd_status || 'draft'}</span>
                      </td>
                    </>}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {tab === 'deduction' && item.atd_status === 'draft' && (
                          <button onClick={() => sendATD(item)} title="Send ATD to employee" className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Send className="w-3.5 h-3.5" /></button>
                        )}
                        {tab === 'deduction' && item.atd_status === 'sent' && (
                          <button onClick={() => approveATD(item)} title="Mark approved & activate" className="p-1.5 rounded hover:bg-green-50 text-green-600"><Check className="w-3.5 h-3.5" /></button>
                        )}
                        {tab === 'deduction' && ['sent', 'active', 'approved'].includes(item.atd_status) && (
                          <button onClick={() => cancelATD(item)} title="Cancel" className="p-1.5 rounded hover:bg-red-50 text-red-600"><X className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <DeductionForm kind={tab} employees={employees} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadData(); }} />
      )}
    </div>
  );
}
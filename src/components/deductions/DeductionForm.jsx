import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAirtableEmployeeName } from '@/utils/airtableEmployee';

export default function DeductionForm({ kind, employees, companies = [], onClose, onSaved }) {
  const isDeduction = kind === 'deduction';
  const [form, setForm] = useState({
    employee_id: '',
    company: '',
    label: '',
    amount_per_cutoff: '',
    total_amount: '',
    total_cutoffs: '',
    start_date: '',
    recurring: !isDeduction,
    notes: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-derive per-cutoff if total & cutoffs are set
  const onTotalsChange = (field, value) => {
    const next = { ...form, [field]: value };
    const total = parseFloat(field === 'total_amount' ? value : next.total_amount);
    const cutoffs = parseInt(field === 'total_cutoffs' ? value : next.total_cutoffs, 10);
    if (total > 0 && cutoffs > 0) next.amount_per_cutoff = String(Math.round((total / cutoffs) * 100) / 100);
    setForm(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emp = employees.find(x => x.id === form.employee_id);
    await base44.entities.EmployeeDeduction.create({
      employee_id: form.employee_id,
      employee_name: emp ? getAirtableEmployeeName(emp) : '',
      company: form.company || '',
      kind,
      label: form.label,
      amount_per_cutoff: parseFloat(form.amount_per_cutoff) || 0,
      total_amount: isDeduction ? (parseFloat(form.total_amount) || 0) : 0,
      total_cutoffs: isDeduction ? (parseInt(form.total_cutoffs, 10) || 0) : 0,
      cutoffs_paid: 0,
      start_date: form.start_date || undefined,
      recurring: isDeduction ? false : true,
      atd_status: isDeduction ? 'draft' : 'active',
      notes: form.notes,
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">{isDeduction ? 'New Charge (ATD)' : 'New Allowance'}</h3>
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
          <div>
            <label className="text-xs font-medium text-muted-foreground">Company / Payroll{isDeduction ? '' : '*'}</label>
            <select value={form.company} onChange={e => set('company', e.target.value)} required={!isDeduction} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-card">
              <option value="">{isDeduction ? 'All companies (default)' : 'Select company'}</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">{isDeduction ? 'Leave blank to charge across all companies.' : 'One employee can receive separate allowances through multiple companies — add one per company.'}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{isDeduction ? 'Charge Label*' : 'Allowance Label*'}</label>
            <Input value={form.label} onChange={e => set('label', e.target.value)} required className="mt-1" placeholder={isDeduction ? 'e.g. Cash Advance' : 'e.g. Transportation'} />
          </div>

          {isDeduction ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Total Amount*</label><Input type="number" step="0.01" min="0" value={form.total_amount} onChange={e => onTotalsChange('total_amount', e.target.value)} required className="mt-1" /></div>
                <div><label className="text-xs font-medium text-muted-foreground"># of Cutoffs*</label><Input type="number" min="1" value={form.total_cutoffs} onChange={e => onTotalsChange('total_cutoffs', e.target.value)} required className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Per Cutoff*</label><Input type="number" step="0.01" min="0" value={form.amount_per_cutoff} onChange={e => set('amount_per_cutoff', e.target.value)} required className="mt-1" /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Start Date*</label><Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} required className="mt-1" /></div>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">Deduction begins on the cutoff covering the start date and runs for the set number of cutoffs (or until the total is fully paid). Send the ATD for the employee to authorize before it goes active.</p>
            </>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount per Cutoff*</label>
              <Input type="number" step="0.01" min="0" value={form.amount_per_cutoff} onChange={e => set('amount_per_cutoff', e.target.value)} required className="mt-1" />
            </div>
          )}

          <div><label className="text-xs font-medium text-muted-foreground">Notes</label><Input value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
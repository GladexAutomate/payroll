import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function EmployeeForm({ employee, departments, onSave, onClose }) {
  const [form, setForm] = useState({
    employee_id: employee?.employee_id || '',
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    middle_name: employee?.middle_name || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    department_id: employee?.department_id || '',
    position: employee?.position || '',
    employment_type: employee?.employment_type || 'regular',
    date_hired: employee?.date_hired || '',
    basic_salary: employee?.basic_salary || '',
    pay_frequency: employee?.pay_frequency || 'semi_monthly',
    biometric_id: employee?.biometric_id || '',
    sss_number: employee?.sss_number || '',
    philhealth_number: employee?.philhealth_number || '',
    pagibig_number: employee?.pagibig_number || '',
    tin: employee?.tin || '',
    allowances: employee?.allowances || 0,
    bank_account: employee?.bank_account || '',
    bank_name: employee?.bank_name || '',
    status: employee?.status || 'active',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, basic_salary: parseFloat(form.basic_salary), allowances: parseFloat(form.allowances) || 0 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg">{employee ? 'Edit Employee' : 'Add New Employee'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Employee ID*</Label><Input value={form.employee_id} onChange={e => set('employee_id', e.target.value)} required /></div>
            <div><Label>Biometric ID</Label><Input value={form.biometric_id} onChange={e => set('biometric_id', e.target.value)} placeholder="Must match device enrollment" /></div>
            <div><Label>First Name*</Label><Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></div>
            <div><Label>Last Name*</Label><Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></div>
            <div><Label>Middle Name</Label><Input value={form.middle_name} onChange={e => set('middle_name', e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div>
              <Label>Department*</Label>
              <Select value={form.department_id} onValueChange={v => set('department_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Position</Label><Input value={form.position} onChange={e => set('position', e.target.value)} /></div>
            <div>
              <Label>Employment Type</Label>
              <Select value={form.employment_type} onValueChange={v => set('employment_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="probationary">Probationary</SelectItem>
                  <SelectItem value="contractual">Contractual</SelectItem>
                  <SelectItem value="part_time">Part-Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date Hired</Label><Input type="date" value={form.date_hired} onChange={e => set('date_hired', e.target.value)} /></div>
            <div><Label>Basic Monthly Salary (₱)*</Label><Input type="number" value={form.basic_salary} onChange={e => set('basic_salary', e.target.value)} required /></div>
            <div>
              <Label>Pay Frequency</Label>
              <Select value={form.pay_frequency} onValueChange={v => set('pay_frequency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semi_monthly">Semi-Monthly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Fixed Allowances (₱/period)</Label><Input type="number" value={form.allowances} onChange={e => set('allowances', e.target.value)} /></div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Government Numbers</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>SSS Number</Label><Input value={form.sss_number} onChange={e => set('sss_number', e.target.value)} /></div>
              <div><Label>PhilHealth Number</Label><Input value={form.philhealth_number} onChange={e => set('philhealth_number', e.target.value)} /></div>
              <div><Label>Pag-IBIG Number</Label><Input value={form.pagibig_number} onChange={e => set('pagibig_number', e.target.value)} /></div>
              <div><Label>TIN</Label><Input value={form.tin} onChange={e => set('tin', e.target.value)} /></div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bank Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></div>
              <div><Label>Account Number</Label><Input value={form.bank_account} onChange={e => set('bank_account', e.target.value)} /></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{employee ? 'Save Changes' : 'Add Employee'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PayPeriodPicker from '@/components/schedule/PayPeriodPicker';

const Select = ({ value, onChange, disabled, placeholder, options }) => (
  <select
    value={value}
    onChange={onChange}
    disabled={disabled}
    className="mt-1 w-full border border-input rounded-md px-3 h-9 text-sm bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
  </select>
);

// Step-by-step proposal form. Each field unlocks once the previous one is filled.
export default function ProposalWizard({ form, setForm, hierarchy, branchOptions, departmentOptions, roleOptions, complete }) {
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const steps = useMemo(() => ([
    { key: 'leader', done: !!form.leader_name },
    { key: 'company', done: !!form.company_name },
    { key: 'branch', done: !!form.branch_name },
    { key: 'department', done: !!form.department_name },
    { key: 'role', done: !!form.department_role },
    { key: 'team', done: !!form.team_name },
    { key: 'period', done: !!form.period_start && !!form.period_end },
  ]), [form]);

  const Step = ({ index, label, children, locked }) => (
    <div className={`flex gap-3 ${locked ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex flex-col items-center pt-1">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${steps[index].done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'}`}>
          {steps[index].done ? <Check className="w-4 h-4" /> : index + 1}
        </div>
        {index < steps.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className="flex-1 pb-5">
        <Label className="text-sm font-semibold">{label}</Label>
        <div className="mt-1.5">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-0">
      <Step index={0} label="1. Leader Name">
        <Input value={form.leader_name} onChange={e => set('leader_name', e.target.value)} placeholder="Enter leader name" />
      </Step>

      <Step index={1} label="2. Company" locked={!form.leader_name}>
        <Select
          value={form.company_name}
          onChange={e => setForm(p => ({ ...p, company_name: e.target.value, branch_name: '', department_name: '', department_role: '' }))}
          placeholder="Select company"
          options={hierarchy.companies}
        />
      </Step>

      <Step index={2} label="3. Branch" locked={!form.company_name}>
        <Select
          value={form.branch_name}
          onChange={e => setForm(p => ({ ...p, branch_name: e.target.value, department_name: '', department_role: '' }))}
          placeholder="Select branch"
          options={branchOptions}
        />
      </Step>

      <Step index={3} label="4. Department" locked={!form.branch_name}>
        <Select
          value={form.department_name}
          onChange={e => setForm(p => ({ ...p, department_name: e.target.value, department_role: '' }))}
          placeholder="Select department"
          options={departmentOptions}
        />
      </Step>

      <Step index={4} label="5. Department Role" locked={!form.department_name}>
        <Select
          value={form.department_role}
          onChange={e => set('department_role', e.target.value)}
          placeholder="Select role"
          options={roleOptions}
        />
      </Step>

      <Step index={5} label="6. Team Name & Leader Email" locked={!form.department_role}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input value={form.team_name} onChange={e => set('team_name', e.target.value)} placeholder="Team name" />
          <Input type="email" value={form.leader_email} onChange={e => set('leader_email', e.target.value)} placeholder="Leader email" />
        </div>
      </Step>

      <Step index={6} label="7. Schedule Period" locked={!form.team_name}>
        <PayPeriodPicker
          periodStart={form.period_start}
          periodEnd={form.period_end}
          onChange={(start, end) => setForm(prev => ({ ...prev, period_start: start, period_end: end }))}
        />
        <div className="mt-3">
          <Label className="text-xs">Notes</Label>
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" />
        </div>
      </Step>
    </div>
  );
}
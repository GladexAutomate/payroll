import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { CalendarDays, Send, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ScheduleGrid from '@/components/schedule/ScheduleGrid';
import ScheduleAnalytics from '@/components/schedule/ScheduleAnalytics';
import ScheduleLegend from '@/components/schedule/ScheduleLegend';
import LeaveNotices from '@/components/schedule/LeaveNotices';
import { buildScheduleSummary, getEmployeeName, getEmployeeSalary, getScheduleDays } from '@/components/schedule/scheduleUtils';
import { buildLeaveOverlay } from '@/components/schedule/leaveOverlay';
import PayPeriodPicker from '@/components/schedule/PayPeriodPicker';

export default function ScheduleProposal() {
  const defaultStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
  const defaultEnd = format(new Date(new Date().getFullYear(), new Date().getMonth(), 15), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    team_name: '', company_name: '', branch_name: '', department_name: '', department_role: '',
    leader_name: '', leader_email: '', period_start: defaultStart, period_end: defaultEnd, notes: '',
  });
  const [hierarchy, setHierarchy] = useState({ companies: [], branches: [], departments: [], departmentRoles: [] });
  const [records, setRecords] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [localEmployees, setLocalEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    setLoading(true);
    const [res, shifts, leaveReqs, locals, org] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'list', pageSize: 100 }),
      base44.entities.ShiftTemplate.list(),
      base44.entities.LeaveRequest.filter({ status: { $in: ['approved', 'pending'] } }, '-created_date', 500),
      base44.entities.Employee.list('-created_date', 2000),
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
    ]);
    setRecords(res.data.records || []);
    setHierarchy(org.data || { companies: [], branches: [], departments: [], departmentRoles: [] });
    setShiftTemplates(shifts || []);
    setLeaves(leaveReqs || []);
    setLocalEmployees(locals || []);
    setLoading(false);
  };

  const employees = useMemo(() => records.map(record => ({
    id: record.id,
    backend_id: record.backend_id,
    airtable_record_id: record.airtable_record_id || record.fields?.['RECORD ID'] || record.id,
    name: getEmployeeName(record),
    monthly_salary: getEmployeeSalary(record),
    department: record.fields?.Department || record.fields?.['Department Role'] || '',
    email: record.fields?.Email || record.fields?.['Business email'] || '',
  })), [records]);

  const selectedEmployees = useMemo(() => employees.filter(emp => selectedIds.includes(emp.id)), [employees, selectedIds]);

  const { overlay: leaveOverlay, notices: leaveNotices } = useMemo(() => buildLeaveOverlay({
    employees: selectedEmployees, leaves, localEmployees, periodStart: form.period_start, periodEnd: form.period_end,
  }), [selectedEmployees, leaves, localEmployees, form.period_start, form.period_end]);

  // Merge auto leave overlay under manual assignments so leaves count in the summary/analytics
  const effectiveAssignments = useMemo(() => {
    const merged = {};
    selectedEmployees.forEach(emp => {
      merged[emp.id] = { ...(leaveOverlay[emp.id] || {}), ...(assignments[emp.id] || {}) };
    });
    return merged;
  }, [selectedEmployees, leaveOverlay, assignments]);

  const summary = useMemo(() => buildScheduleSummary({ employees: selectedEmployees, assignments: effectiveAssignments, periodStart: form.period_start, periodEnd: form.period_end }), [selectedEmployees, effectiveAssignments, form.period_start, form.period_end]);

  const branchOptions = useMemo(() => hierarchy.branches.filter(b => !form.company_name || b.company_name === form.company_name), [hierarchy, form.company_name]);
  const departmentOptions = useMemo(() => hierarchy.departments.filter(d => (!form.company_name || d.company_name === form.company_name) && (!form.branch_name || d.branch_name === form.branch_name)), [hierarchy, form.company_name, form.branch_name]);
  const roleOptions = useMemo(() => hierarchy.departmentRoles.filter(r => (!form.company_name || r.company_name === form.company_name) && (!form.branch_name || r.branch_name === form.branch_name) && (!form.department_name || r.department_name === form.department_name)), [hierarchy, form.company_name, form.branch_name, form.department_name]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleEmployee = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  const updateSchedule = (employeeId, date, type) => setAssignments(prev => ({ ...prev, [employeeId]: { ...(prev[employeeId] || {}), [date]: type } }));

  const days = useMemo(() => getScheduleDays(form.period_start, form.period_end).map(d => format(d, 'yyyy-MM-dd')), [form.period_start, form.period_end]);

  const fillSchedule = (employeeId, date, type, direction) => {
    setAssignments(prev => {
      const next = { ...prev };
      const dayIdx = days.indexOf(date);
      const empIdx = selectedEmployees.findIndex(e => e.id === employeeId);
      if (direction === 'left' || direction === 'right') {
        const row = { ...(next[employeeId] || {}) };
        const from = direction === 'left' ? 0 : dayIdx;
        const to = direction === 'left' ? dayIdx : days.length - 1;
        for (let i = from; i <= to; i++) row[days[i]] = type;
        next[employeeId] = row;
      } else if (direction === 'up' || direction === 'down') {
        const from = direction === 'up' ? 0 : empIdx;
        const to = direction === 'up' ? empIdx : selectedEmployees.length - 1;
        for (let i = from; i <= to; i++) {
          const emp = selectedEmployees[i];
          next[emp.id] = { ...(next[emp.id] || {}), [date]: type };
        }
      }
      return next;
    });
  };

  const submitProposal = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.AttendanceProposal.create({
      ...form,
      status: 'pending_hr_review',
      employees: selectedEmployees,
      assignments: effectiveAssignments,
      summary,
    });
    setSaving(false);
    setSelectedIds([]);
    setAssignments({});
    setForm(prev => ({ ...prev, team_name: '', notes: '' }));
  };

  return (
    <form onSubmit={submitProposal} className="space-y-5">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">Schedule Proposal</h2>
            <p className="text-xs text-muted-foreground">Create the team schedule request for HR review.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label className="text-xs">Team Name*</Label><Input value={form.team_name} onChange={e => set('team_name', e.target.value)} required className="mt-1" /></div>
          <div>
            <Label className="text-xs">Company*</Label>
            <select value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value, branch_name: '', department_name: '', department_role: '' }))} required className="mt-1 w-full border border-input rounded-md px-3 h-9 text-sm bg-transparent">
              <option value="">Select company</option>
              {hierarchy.companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Branch</Label>
            <select value={form.branch_name} onChange={e => setForm(p => ({ ...p, branch_name: e.target.value, department_name: '', department_role: '' }))} className="mt-1 w-full border border-input rounded-md px-3 h-9 text-sm bg-transparent">
              <option value="">Select branch</option>
              {branchOptions.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Department</Label>
            <select value={form.department_name} onChange={e => setForm(p => ({ ...p, department_name: e.target.value, department_role: '' }))} className="mt-1 w-full border border-input rounded-md px-3 h-9 text-sm bg-transparent">
              <option value="">Select department</option>
              {departmentOptions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Department Role</Label>
            <select value={form.department_role} onChange={e => set('department_role', e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 h-9 text-sm bg-transparent">
              <option value="">Select role</option>
              {roleOptions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Leader Name</Label><Input value={form.leader_name} onChange={e => set('leader_name', e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Leader Email</Label><Input type="email" value={form.leader_email} onChange={e => set('leader_email', e.target.value)} className="mt-1" /></div>
          <PayPeriodPicker
            periodStart={form.period_start}
            periodEnd={form.period_end}
            onChange={(start, end) => setForm(prev => ({ ...prev, period_start: start, period_end: end }))}
          />
          <div className="md:col-span-3"><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" /></div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">Select Employees</h3></div>
          <span className="text-xs text-muted-foreground">{selectedEmployees.length} selected</span>
        </div>
        {loading ? <div className="text-sm text-muted-foreground py-6">Loading Airtable employees...</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-auto pr-1">
            {employees.map(emp => (
              <label key={emp.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm cursor-pointer hover:bg-muted/40">
                <input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => toggleEmployee(emp.id)} />
                <span className="flex-1 truncate">{emp.name}</span>
                <span className="text-xs text-muted-foreground">₱{Math.round(emp.monthly_salary).toLocaleString()}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {selectedEmployees.length > 0 && (
        <>
          <LeaveNotices notices={leaveNotices} />
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground">Drag a card onto a cell (then choose fill left/right/down or delete), or click a cell to cycle. Dates with a leave request on file are outlined in yellow.</p>
            <ScheduleLegend shiftTemplates={shiftTemplates} draggable />
            <ScheduleGrid employees={selectedEmployees} assignments={assignments} leaveOverlay={leaveOverlay} shiftTemplates={shiftTemplates} periodStart={form.period_start} periodEnd={form.period_end} editable onChange={updateSchedule} onFill={fillSchedule} />
          </div>
          <ScheduleAnalytics summary={summary} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || selectedEmployees.length === 0}>
              <Send className="w-4 h-4 mr-1.5" /> {saving ? 'Submitting...' : 'Submit Schedule Request'}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
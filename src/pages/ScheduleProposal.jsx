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
import ProposalWizard from '@/components/schedule/ProposalWizard';

const cell = (v) => String(v || '').trim().toLowerCase();

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
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    setLoading(true);
    const [res, shifts, leaveReqs, locals, org, teamData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'allActive' }),
      base44.entities.ShiftTemplate.list('sort_order'),
      base44.entities.LeaveRequest.filter({ status: { $in: ['approved', 'pending'] } }, '-created_date', 500),
      base44.entities.Employee.list('-created_date', 2000),
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.entities.Team.list('name', 1000),
    ]);
    setRecords(res.data.records || []);
    setHierarchy(org.data || { companies: [], branches: [], departments: [], departmentRoles: [] });
    setShiftTemplates(shifts || []);
    setLeaves(leaveReqs || []);
    setLocalEmployees(locals || []);
    setTeams(teamData || []);
    setLoading(false);
  };

  // Resolve the selected org names to their ids so we can scope teams under them.
  const selectedOrgIds = useMemo(() => {
    const company = hierarchy.companies.find(c => c.name === form.company_name);
    const branch = hierarchy.branches.find(b => b.name === form.branch_name);
    const department = hierarchy.departments.find(d => d.name === form.department_name);
    const role = hierarchy.departmentRoles.find(r => r.name === form.department_role);
    return {
      company_id: company?.id || '',
      branch_id: branch?.id || '',
      department_id: department?.id || '',
      sub_department_id: role?.id || '',
    };
  }, [hierarchy, form.company_name, form.branch_name, form.department_name, form.department_role]);

  // Only show teams registered under the chosen company/branch/department/role.
  const teamOptions = useMemo(() => teams.filter(t => {
    if (selectedOrgIds.company_id && t.company_id && t.company_id !== selectedOrgIds.company_id) return false;
    if (selectedOrgIds.branch_id && t.branch_id && t.branch_id !== selectedOrgIds.branch_id) return false;
    if (selectedOrgIds.department_id && t.department_id && t.department_id !== selectedOrgIds.department_id) return false;
    if (selectedOrgIds.sub_department_id && t.sub_department_id && t.sub_department_id !== selectedOrgIds.sub_department_id) return false;
    return true;
  }), [teams, selectedOrgIds]);

  // Create a new team registered under the currently selected org path, then select it.
  // Pre-select members of any previously-saved team with the same name for easier scheduling.
  const createTeam = async (teamName) => {
    const existingSameName = teams.find(t => cell(t.name) === cell(teamName));
    const created = await base44.entities.Team.create({
      name: teamName,
      ...selectedOrgIds,
      department_name: form.department_name,
      leader_name: form.leader_name,
      leader_email: form.leader_email,
      member_record_ids: existingSameName?.member_record_ids || [],
      status: 'active',
    });
    const fresh = await base44.entities.Team.list('name', 1000);
    setTeams(fresh || []);
    setForm(prev => ({ ...prev, team_name: created?.name || teamName }));
  };

  const allEmployees = useMemo(() => records.map(record => ({
    id: record.id,
    backend_id: record.backend_id,
    airtable_record_id: record.airtable_record_id || record.fields?.['RECORD ID'] || record.id,
    name: getEmployeeName(record),
    monthly_salary: getEmployeeSalary(record),
    company: record.fields?.Company || record.fields?.COMPANY || '',
    branch: record.fields?.Branch || record.fields?.BRANCH || '',
    department: record.fields?.Department || '',
    department_role: record.fields?.['Department Role'] || '',
    email: record.fields?.Email || record.fields?.['Business email'] || '',
  })), [records]);

  // Form must be complete before employees show; then only show those under the chosen org path.
  const formComplete = !!(form.leader_name && form.company_name && form.branch_name && form.department_name && form.department_role && form.team_name);

  const employees = useMemo(() => {
    if (!formComplete) return [];
    return allEmployees.filter(emp =>
      cell(emp.company) === cell(form.company_name) &&
      cell(emp.branch) === cell(form.branch_name) &&
      cell(emp.department) === cell(form.department_name) &&
      cell(emp.department_role) === cell(form.department_role)
    );
  }, [allEmployees, formComplete, form.company_name, form.branch_name, form.department_name, form.department_role]);

  // When a team is picked, pre-select its previously-saved members (matched against the
  // employees available under the chosen org path). User can still add/remove manually.
  useEffect(() => {
    if (!form.team_name || employees.length === 0) return;
    const team = teams.find(t => cell(t.name) === cell(form.team_name));
    const memberIds = new Set((team?.member_record_ids || []).map(String));
    if (memberIds.size === 0) return;
    const preselected = employees
      .filter(emp => memberIds.has(String(emp.id)) || memberIds.has(String(emp.airtable_record_id)) || memberIds.has(String(emp.backend_id)))
      .map(emp => emp.id);
    setSelectedIds(preselected);
  }, [form.team_name, employees, teams]);

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

  const fillScheduleTo = (employeeId, date, type, axis, target) => {
    setAssignments(prev => {
      const next = { ...prev };
      if (axis === 'horizontal') {
        const from = days.indexOf(date);
        const to = days.indexOf(target.date);
        if (from === -1 || to === -1) return prev;
        const [a, b] = from <= to ? [from, to] : [to, from];
        const row = { ...(next[employeeId] || {}) };
        for (let i = a; i <= b; i++) row[days[i]] = type;
        next[employeeId] = row;
      } else {
        const from = selectedEmployees.findIndex(e => e.id === employeeId);
        const to = selectedEmployees.findIndex(e => e.id === target.employeeId);
        if (from === -1 || to === -1) return prev;
        const [a, b] = from <= to ? [from, to] : [to, from];
        for (let i = a; i <= b; i++) {
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
        <ProposalWizard
          form={form}
          setForm={setForm}
          hierarchy={hierarchy}
          branchOptions={branchOptions}
          departmentOptions={departmentOptions}
          roleOptions={roleOptions}
          teamOptions={teamOptions}
          onCreateTeam={createTeam}
          complete={formComplete}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">Select Employees</h3></div>
          <span className="text-xs text-muted-foreground">{selectedEmployees.length} selected</span>
        </div>
        {!formComplete ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Complete the schedule details above to load employees.</div>
        ) : loading ? <div className="text-sm text-muted-foreground py-6">Loading Airtable employees...</div> : employees.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No employees found under the selected company, branch, department and role.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-auto pr-1">
            {employees.map(emp => (
              <label key={emp.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm cursor-pointer hover:bg-muted/40">
                <input type="checkbox" checked={selectedIds.includes(emp.id)} onChange={() => toggleEmployee(emp.id)} />
                <span className="flex-1 truncate">{emp.name}</span>
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
            <ScheduleGrid employees={selectedEmployees} assignments={assignments} leaveOverlay={leaveOverlay} shiftTemplates={shiftTemplates} periodStart={form.period_start} periodEnd={form.period_end} editable onChange={updateSchedule} onFill={fillSchedule} onFillTo={fillScheduleTo} />
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
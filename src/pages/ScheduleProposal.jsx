import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Send, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ADMIN_USER, hasAdminAccess } from '@/lib/adminAccess';
import ScheduleGrid from '@/components/schedule/ScheduleGrid';
import ScheduleAnalytics from '@/components/schedule/ScheduleAnalytics';
import ScheduleLegend from '@/components/schedule/ScheduleLegend';
import LeaveNotices from '@/components/schedule/LeaveNotices';
import { buildScheduleSummary, getEmployeeName, getEmployeeSalary, getScheduleDays } from '@/components/schedule/scheduleUtils';
import { buildLeaveOverlay } from '@/components/schedule/leaveOverlay';
import PayPeriodPicker from '@/components/schedule/PayPeriodPicker';

const cell = (v) => String(v || '').trim().toLowerCase();

// Read a record field by name, ignoring case (Airtable column casing varies, e.g.
// "Immediate Head" vs "IMMEDIATE HEAD").
const getField = (fields, name) => {
  const target = String(name).toLowerCase();
  const key = Object.keys(fields || {}).find(k => k.toLowerCase() === target);
  return key != null ? fields[key] : undefined;
};

// Identity key for matching an employee to their leader: FIRST + LAST name only
// (middle names/initials are ignored), normalized to uppercase letters so that
// "Russel Laluces", "RUSSEL LALUCES" and "Russel D. Laluces" all match.
const nameKey = (value) => {
  const tokens = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0];
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
};

export default function ScheduleProposal() {
  const defaultStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
  const defaultEnd = format(new Date(new Date().getFullYear(), new Date().getMonth(), 15), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    team_name: '', company_name: '', branch_name: '', department_name: '', department_role: '',
    leader_name: '', leader_email: '', period_start: defaultStart, period_end: defaultEnd, notes: '',
  });
  const [records, setRecords] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [localEmployees, setLocalEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [myName, setMyName] = useState('');   // the logged-in leader's name (for matching + display)
  const [identified, setIdentified] = useState(false); // whether we resolved the current user at all
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    setLoading(true);

    // Resolve the current user, then their own employee record for an accurate name
    // (and org context for HR review) before loading the roster.
    const me = hasAdminAccess() ? ADMIN_USER : await base44.auth.me().catch(() => null);
    let leaderName = me?.full_name || '';
    let leaderEmail = me?.email || '';
    let leaderOrg = { company_name: '', branch_name: '', department_name: '', department_role: '' };
    const recId = me?.employee_airtable_record_id;
    if (recId) {
      const recs = await base44.entities.AirtableEmployeeRecord
        .filter({ airtable_record_id: recId }, '-updated_date', 1)
        .catch(() => []);
      if (recs.length) {
        const f = recs[0].fields || {};
        leaderName = recs[0].full_name
          || [getField(f, 'first name'), getField(f, 'last name')].filter(Boolean).join(' ')
          || leaderName;
        leaderEmail = leaderEmail || getField(f, 'business email') || getField(f, 'email') || '';
        leaderOrg = {
          company_name: recs[0].company || getField(f, 'company') || '',
          branch_name: recs[0].branch || getField(f, 'branch') || '',
          department_name: recs[0].department || getField(f, 'department') || '',
          department_role: recs[0].department_role || getField(f, 'department role') || '',
        };
      }
    }
    setMyName(leaderName);
    setIdentified(!!me);
    setForm(prev => ({ ...prev, leader_name: leaderName, leader_email: leaderEmail, ...leaderOrg }));

    const [res, shifts, leaveReqs, locals, teamData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'allActive' }),
      base44.entities.ShiftTemplate.list('sort_order'),
      base44.entities.LeaveRequest.filter({ status: { $in: ['approved', 'pending'] } }, '-created_date', 500),
      base44.entities.Employee.list('-created_date', 2000),
      base44.entities.Team.list('name', 1000),
    ]);
    setRecords(res.data.records || []);
    setShiftTemplates(shifts || []);
    setLeaves(leaveReqs || []);
    setLocalEmployees(locals || []);
    setTeams(teamData || []);
    setLoading(false);
  };

  const allEmployees = useMemo(() => records.map(record => ({
    id: record.id,
    backend_id: record.backend_id,
    airtable_record_id: record.airtable_record_id || record.fields?.['RECORD ID'] || record.id,
    name: getEmployeeName(record),
    monthly_salary: getEmployeeSalary(record),
    immediate_head: getField(record.fields, 'immediate head') || '',
    email: record.fields?.Email || record.fields?.['Business email'] || '',
  })), [records]);

  // The leader's identity key. Everyone (including admins) is scoped to the employees
  // who list them as their Immediate Head.
  const myKey = useMemo(() => nameKey(myName), [myName]);

  // Direct reports: active employees whose Immediate Head matches the logged-in user
  // by first + last name.
  const employees = useMemo(() => {
    if (!myKey) return [];
    return allEmployees.filter(emp => emp.immediate_head && nameKey(emp.immediate_head) === myKey);
  }, [allEmployees, myKey]);

  // Pre-select all direct reports by default; the leader can still deselect any.
  useEffect(() => {
    setSelectedIds(employees.map(emp => emp.id));
  }, [employees]);

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

  const summary = useMemo(() => buildScheduleSummary({
    employees: selectedEmployees,
    assignments: effectiveAssignments,
    periodStart: form.period_start,
    periodEnd: form.period_end,
    shiftTemplates,
  }), [selectedEmployees, effectiveAssignments, form.period_start, form.period_end, shiftTemplates]);

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
    // Team name is derived from the leader so the proposal/Teams page stay populated
    // without the old org checklist.
    const team_name = myName ? `${myName}'s Team` : 'My Team';
    await base44.entities.AttendanceProposal.create({
      ...form,
      team_name,
      status: 'pending_hr_review',
      employees: selectedEmployees,
      assignments: effectiveAssignments,
      summary,
    });

    // Keep the leader's team membership current so it shows on the Teams page.
    const memberIds = selectedEmployees.map(emp => String(emp.airtable_record_id || emp.id));
    const existingTeam = teams.find(t => cell(t.name) === cell(team_name));
    const teamData = {
      leader_name: form.leader_name,
      leader_email: form.leader_email,
      department_name: form.department_name,
      member_record_ids: memberIds,
    };
    if (existingTeam) {
      await base44.entities.Team.update(existingTeam.id, teamData);
    } else {
      await base44.entities.Team.create({ name: team_name, status: 'active', ...teamData });
    }
    const refreshedTeams = await base44.entities.Team.list('name', 1000).catch(() => []);
    setTeams(refreshedTeams || []);

    setSaving(false);
    setAssignments({});
    setForm(prev => ({ ...prev, notes: '' }));
  };

  return (
    <form onSubmit={submitProposal} className="space-y-5">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">Schedule Proposal</h2>
            <p className="text-xs text-muted-foreground">Create a schedule request for your team — only employees who report to you are shown.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-sm font-semibold">Leader</Label>
            <p className="text-sm text-muted-foreground mt-1.5">{myName || (loading ? 'Loading…' : 'Unknown user')}</p>
          </div>
          <div>
            <Label className="text-sm font-semibold">Schedule Period</Label>
            <div className="mt-1.5">
              <PayPeriodPicker
                periodStart={form.period_start}
                periodEnd={form.period_end}
                onChange={(start, end) => setForm(prev => ({ ...prev, period_start: start, period_end: end }))}
              />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Label className="text-xs">Notes</Label>
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">Your Team</h3></div>
          <span className="text-xs text-muted-foreground">{selectedEmployees.length} of {employees.length} selected</span>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground py-6">Loading your team...</div>
        ) : !identified || !myName ? (
          <div className="text-sm text-muted-foreground py-6 text-center">We couldn't identify your account, so your team couldn't be loaded.</div>
        ) : employees.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No employees list <strong>{myName}</strong> as their Immediate Head, so there's no one to schedule.</div>
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

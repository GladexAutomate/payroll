import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { CalendarCheck, RefreshCw, Download, Pencil, Save, X, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ScheduleGrid from '@/components/schedule/ScheduleGrid';
import ScheduleLegend from '@/components/schedule/ScheduleLegend';
import LeaveNotices from '@/components/schedule/LeaveNotices';
import ReconcileBar from '@/components/schedule/ReconcileBar.jsx';
import { getEmployeeName, getEmployeeSalary } from '@/components/schedule/scheduleUtils';
import { useCurrentTier } from '@/hooks/useCurrentTier';
import { buildLeaveOverlay } from '@/components/schedule/leaveOverlay';
import { buildActualOverlay } from '@/components/schedule/buildActualOverlay';
import { exportApprovedScheduleToExcel } from '@/components/schedule/exportApprovedSchedule';
import PayPeriodPicker from '@/components/schedule/PayPeriodPicker';
import EmployeeScheduleEditModal from '@/components/schedule/EmployeeScheduleEditModal';

const getCurrentPayPeriod = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const isFirstHalf = today.getDate() <= 15;
  const start = new Date(year, month, isFirstHalf ? 1 : 16);
  const end = isFirstHalf ? new Date(year, month, 15) : new Date(year, month + 1, 0);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
};

export default function ApprovedSchedule({ readOnly = false }) {
  const defaultPeriod = useMemo(() => getCurrentPayPeriod(), []);
  const [periodStart, setPeriodStart] = useState(defaultPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod.end);
  const [records, setRecords] = useState([]);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [plotted, setPlotted] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [localEmployees, setLocalEmployees] = useState([]);
  const [airtableMatches, setAirtableMatches] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [approvedProposals, setApprovedProposals] = useState([]);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [showActual, setShowActual] = useState(false);
  const [teams, setTeams] = useState([]);
  const [editEmployee, setEditEmployee] = useState(null);
  const { toast } = useToast();
  const { tier, signerName, signerRole } = useCurrentTier();
  // Only HR, Managers, and Leaders/Supervisors can modify the approved schedule.
  const canEdit = ['hr', 'managers', 'leaders'].includes(tier);
  const [searchParams] = useSearchParams();
  const params = useParams();
  const scope = params.scope || searchParams.get('scope') || '';
  const scopeValue = params.value ? decodeURIComponent(params.value) : (searchParams.get('value') || '');

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadRange(); }, [periodStart, periodEnd]);

  const loadBase = async () => {
    setLoading(true);
    const [res, shifts, locals, matches, teamData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'allActive' }),
      base44.entities.ShiftTemplate.list(),
      base44.entities.Employee.list('-updated_date', 5000),
      base44.entities.EmployeeAirtableMatch.list('-updated_date', 5000),
      base44.entities.Team.list('name', 1000),
    ]);
    setRecords(res.data.records || []);
    setShiftTemplates(shifts || []);
    setLocalEmployees(locals || []);
    setAirtableMatches(matches || []);
    setTeams(teamData || []);
    setLoading(false);
    loadRange();
  };

  const loadRange = async () => {
    const [plottedData, leaveData, logsData, proposalData] = await Promise.all([
      base44.entities.ApprovedSchedule.filter({ date: { $gte: periodStart, $lte: periodEnd } }, '-date', 5000),
      base44.entities.LeaveRequest.filter({
        date_from: { $lte: periodEnd },
        date_to: { $gte: periodStart },
      }, '-date_from', 5000),
      base44.entities.AttendanceLog.filter({ date: { $gte: periodStart, $lte: periodEnd } }, 'date', 5000),
      base44.entities.AttendanceProposal.list('-created_date', 1000),
    ]);
    setPlotted(plottedData || []);
    setLeaves(leaveData || []);
    setAttendanceLogs(logsData || []);
    setApprovedProposals(proposalData || []);
  };

  const employees = useMemo(() => records.map(record => ({
    id: record.id,
    backend_id: record.backend_id,
    airtable_record_id: record.airtable_record_id || record.fields?.['RECORD ID'] || record.id,
    name: getEmployeeName(record),
    monthly_salary: getEmployeeSalary(record),
    department: record.fields?.Department || record.fields?.['Department Role'] || '',
    company_name: record.fields?.Company || record.fields?.COMPANY || '',
    branch_name: record.fields?.Branch || record.fields?.BRANCH || '',
    department_name: record.fields?.Department || '',
    department_role: record.fields?.['Department Role'] || '',
    team: record.fields?.Team || record.fields?.TEAM || '',
  })), [records]);

  const cell = (v) => String(v || '').trim().toLowerCase();

  // Scope value may be a pipe-delimited path so same-named departments/roles under
  // different companies/branches stay separate, e.g. "Company|Branch|Department|Role".
  const scopeParts = useMemo(() => scopeValue.split('|').map(p => p.trim()), [scopeValue]);
  const matchesPart = (val, part) => !part || cell(val) === cell(part);

  // Scope filter from URL (?scope=branch|department|department_role|team&value=...)
  const scopedEmployees = useMemo(() => {
    if (!scope || !scopeValue) return employees;
    const [teamScopeValue, proposalScopeId] = scope === 'team' && scopeParts.length > 1 ? scopeParts : [scopeValue, ''];
    const matchingTeams = scope === 'team'
      ? teams.filter(t => String(t.id) === teamScopeValue || cell(t.name) === cell(teamScopeValue))
      : [];
    const team = matchingTeams[0] || null;
    const teamName = team?.name || teamScopeValue;
    const proposalEmployeeIds = new Set();
    const proposalEmployeeSnapshots = [];
    const plottedSourceIds = new Set(plotted.map(row => row.source_proposal_id).filter(Boolean).map(String));
    approvedProposals.forEach(proposal => {
      if (plottedSourceIds.size > 0 && !plottedSourceIds.has(String(proposal.id))) return;
      let matches = false;
      if (scope === 'branch') {
        const [company, branch] = scopeParts.length > 1 ? scopeParts : ['', scopeParts[0]];
        matches = matchesPart(proposal.company_name, company) && matchesPart(proposal.branch_name, branch);
      } else if (scope === 'department') {
        const [company, branch, dept] = scopeParts.length > 1 ? scopeParts : ['', '', scopeParts[0]];
        matches = matchesPart(proposal.company_name, company) && matchesPart(proposal.branch_name, branch) && matchesPart(proposal.department_name, dept);
      } else if (scope === 'department_role') {
        const [company, branch, dept, role] = scopeParts.length > 1 ? scopeParts : ['', '', '', scopeParts[0]];
        matches = matchesPart(proposal.company_name, company) && matchesPart(proposal.branch_name, branch) && matchesPart(proposal.department_name, dept) && matchesPart(proposal.department_role, role);
      } else if (scope === 'team') {
        matches = proposalScopeId
          ? String(proposal.id) === proposalScopeId
          : cell(proposal.team_name) === cell(teamName);
      }
      if (!matches) return;
      (proposal.employees || []).forEach(emp => {
        [emp.id, emp.airtable_record_id, emp.backend_id].filter(Boolean).forEach(id => proposalEmployeeIds.add(String(id)));
        proposalEmployeeSnapshots.push({
          id: emp.id,
          backend_id: emp.backend_id,
          airtable_record_id: emp.airtable_record_id || emp.id,
          name: emp.name || emp.employee_name || '',
          monthly_salary: emp.monthly_salary || 0,
          department: emp.department || emp.department_role || '',
          company_name: emp.company || emp.company_name || proposal.company_name || '',
          branch_name: emp.branch || emp.branch_name || proposal.branch_name || '',
          department_name: emp.department || emp.department_name || proposal.department_name || '',
          department_role: emp.department_role || proposal.department_role || '',
          team: emp.team || proposal.team_name || '',
        });
      });
    });
    const matchesProposalEmployee = (e) =>
      proposalEmployeeIds.has(String(e.id)) ||
      proposalEmployeeIds.has(String(e.airtable_record_id)) ||
      proposalEmployeeIds.has(String(e.backend_id));
    const withProposalFallback = (baseEmployees) => {
      const seen = new Set();
      const merged = [];
      [...baseEmployees, ...proposalEmployeeSnapshots].forEach(emp => {
        const key = String(emp.id || emp.airtable_record_id || emp.backend_id || emp.name || '').trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(emp);
      });
      return merged;
    };

    if (scope === 'branch') {
      const [company, branch] = scopeParts.length > 1 ? scopeParts : ['', scopeParts[0]];
      return withProposalFallback(employees.filter(e => matchesProposalEmployee(e) || (matchesPart(e.company_name, company) && matchesPart(e.branch_name, branch))));
    }
    if (scope === 'department') {
      const [company, branch, dept] = scopeParts.length > 1 ? scopeParts : ['', '', scopeParts[0]];
      return withProposalFallback(employees.filter(e => matchesProposalEmployee(e) || (matchesPart(e.company_name, company) && matchesPart(e.branch_name, branch) && matchesPart(e.department_name, dept))));
    }
    if (scope === 'department_role') {
      const [company, branch, dept, role] = scopeParts.length > 1 ? scopeParts : ['', '', '', scopeParts[0]];
      return withProposalFallback(employees.filter(e => matchesProposalEmployee(e) || (matchesPart(e.company_name, company) && matchesPart(e.branch_name, branch) && matchesPart(e.department_name, dept) && matchesPart(e.department_role, role))));
    }
    if (scope === 'team') {
      const memberIds = new Set(matchingTeams.flatMap(t => t.member_record_ids || []).map(String));
      return withProposalFallback(employees.filter(e =>
        matchesProposalEmployee(e) ||
        memberIds.has(String(e.airtable_record_id)) ||
        memberIds.has(String(e.backend_id)) ||
        memberIds.has(String(e.id)) ||
        cell(e.team) === cell(teamName)
      ));
    }
    return employees;
  }, [employees, teams, approvedProposals, plotted, scope, scopeValue, scopeParts]);

  const branchOptions = useMemo(() => {
    const set = new Set();
    scopedEmployees.forEach(e => { const b = String(e.branch_name || '').trim(); if (b) set.add(b); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedEmployees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedEmployees.filter(e => {
      const matchesBranch = branchFilter === 'all' || cell(e.branch_name) === cell(branchFilter);
      const matchesSearch = !q || e.name.toLowerCase().includes(q) || (e.department || '').toLowerCase().includes(q);
      return matchesBranch && matchesSearch;
    });
  }, [scopedEmployees, search, branchFilter]);

  // Pending leaves -> glow overlay; approved leaves -> plotted onto dates
  const pendingLeaves = useMemo(() => leaves.filter(l => l.status === 'pending'), [leaves]);
  const approvedLeaves = useMemo(() => leaves.filter(l => l.status === 'approved'), [leaves]);

  const { overlay: leaveOverlay, notices } = useMemo(() => buildLeaveOverlay({
    employees: filteredEmployees, leaves: pendingLeaves, localEmployees, periodStart, periodEnd,
  }), [filteredEmployees, pendingLeaves, localEmployees, periodStart, periodEnd]);

  const approvedLeaveOverlay = useMemo(() => buildLeaveOverlay({
    employees: filteredEmployees, leaves: approvedLeaves, localEmployees, periodStart, periodEnd,
  }).overlay, [filteredEmployees, approvedLeaves, localEmployees, periodStart, periodEnd]);

  // Build assignments map from plotted records + approved leaves (key by employee_id)
  const baseAssignments = useMemo(() => {
    const map = {};
    plotted.forEach(rec => {
      map[rec.employee_id] = map[rec.employee_id] || {};
      map[rec.employee_id][rec.date] = rec.schedule_type;
    });
    Object.entries(approvedLeaveOverlay).forEach(([empId, dayMap]) => {
      map[empId] = map[empId] || {};
      Object.entries(dayMap).forEach(([date, type]) => {
        if (!map[empId][date]) map[empId][date] = type;
      });
    });
    return map;
  }, [plotted, approvedLeaveOverlay]);

  // Merge draft edits on top of base assignments for display/export
  const assignments = useMemo(() => {
    const map = JSON.parse(JSON.stringify(baseAssignments));
    Object.entries(draft).forEach(([empId, dayMap]) => {
      map[empId] = map[empId] || {};
      Object.entries(dayMap).forEach(([date, type]) => { map[empId][date] = type; });
    });
    return map;
  }, [baseAssignments, draft]);

  const actualOverlay = useMemo(() => {
    if (!showActual) return null;
    return buildActualOverlay({
      employees: filteredEmployees, logs: attendanceLogs, localEmployees, airtableMatches, assignments, periodStart, periodEnd,
    });
  }, [showActual, filteredEmployees, attendanceLogs, localEmployees, airtableMatches, assignments, periodStart, periodEnd]);

  const handleCellChange = (empId, date, type) => {
    setDraft(prev => ({ ...prev, [empId]: { ...(prev[empId] || {}), [date]: type } }));
  };

  const dayKeys = useMemo(() => {
    const out = [];
    let d = new Date(periodStart);
    const end = new Date(periodEnd);
    while (d <= end) { out.push(format(d, 'yyyy-MM-dd')); d = addDays(d, 1); }
    return out;
  }, [periodStart, periodEnd]);

  const handleFillTo = (empId, date, type, axis, target) => {
    setDraft(prev => {
      const next = { ...prev };
      if (axis === 'horizontal') {
        const from = dayKeys.indexOf(date);
        const to = dayKeys.indexOf(target.date);
        if (from === -1 || to === -1) return prev;
        const [a, b] = from <= to ? [from, to] : [to, from];
        const row = { ...(next[empId] || {}) };
        for (let i = a; i <= b; i++) row[dayKeys[i]] = type;
        next[empId] = row;
      } else {
        const from = filteredEmployees.findIndex(e => e.id === empId);
        const to = filteredEmployees.findIndex(e => e.id === target.employeeId);
        if (from === -1 || to === -1) return prev;
        const [a, b] = from <= to ? [from, to] : [to, from];
        for (let i = a; i <= b; i++) {
          const emp = filteredEmployees[i];
          next[emp.id] = { ...(next[emp.id] || {}), [date]: type };
        }
      }
      return next;
    });
  };

  const cancelEdit = () => { setDraft({}); setEditMode(false); };

  const saveEdits = async () => {
    setSaving(true);
    const edits = [];
    Object.entries(draft).forEach(([empId, dayMap]) => {
      Object.entries(dayMap).forEach(([date, type]) => edits.push({ empId, date, type }));
    });

    for (const edit of edits) {
      const existing = plotted.find(r => r.employee_id === edit.empId && r.date === edit.date);
      const emp = filteredEmployees.find(e => e.id === edit.empId);
      if (edit.type === 'none') {
        if (existing) await base44.entities.ApprovedSchedule.delete(existing.id);
      } else if (existing) {
        await base44.entities.ApprovedSchedule.update(existing.id, { schedule_type: edit.type });
      } else {
        await base44.entities.ApprovedSchedule.create({
          employee_id: edit.empId,
          employee_name: emp?.name || '',
          department: emp?.department || '',
          date: edit.date,
          schedule_type: edit.type,
          source_proposal_id: 'manual',
        });
      }
    }

    setSaving(false);
    setDraft({});
    setEditMode(false);
    toast({ title: 'Schedule saved', description: `${edits.length} cell(s) updated.` });
    loadRange();
  };

  // Per-employee save (Airtable-style modal). Writes ApprovedSchedule and logs each change.
  const saveEmployeeEdits = async (emp, edits) => {
    for (const edit of edits) {
      const existing = plotted.find(r => r.employee_id === emp.id && r.date === edit.date);
      if (edit.newValue === 'none') {
        if (existing) await base44.entities.ApprovedSchedule.delete(existing.id);
      } else if (existing) {
        await base44.entities.ApprovedSchedule.update(existing.id, { schedule_type: edit.newValue });
      } else {
        await base44.entities.ApprovedSchedule.create({
          employee_id: emp.id,
          employee_name: emp.name || '',
          department: emp.department || '',
          date: edit.date,
          schedule_type: edit.newValue,
          source_proposal_id: 'manual',
        });
      }
      await base44.entities.ScheduleChangeLog.create({
        employee_id: emp.id,
        employee_name: emp.name || '',
        department: emp.department || '',
        date: edit.date,
        old_value: edit.oldValue,
        new_value: edit.newValue,
        old_label: edit.oldLabel,
        new_label: edit.newLabel,
        changed_by: signerName || 'Unknown',
        changed_by_role: signerRole || tier,
        period_start: periodStart,
        period_end: periodEnd,
      });
    }
    setEditEmployee(null);
    toast({ title: 'Schedule updated', description: `${edits.length} day(s) changed for ${emp.name}. Logged to history.` });
    loadRange();
  };

  const handleExport = () => {
    exportApprovedScheduleToExcel({ employees: filteredEmployees, assignments, shiftTemplates, periodStart, periodEnd });
  };

  const plottedCount = plotted.length;

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold">Approved Schedule</h2>
              <p className="text-xs text-muted-foreground">{editMode ? 'Edit mode — click any cell to cycle its schedule card, then Save.' : 'Blank schedule for all active employees — auto-plotted when a proposal is approved.'}</p>
              {scope && scopeValue && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
                  <Filter className="w-3 h-3" /> {scope.replace('_', ' ')}: {scopeParts.filter(Boolean).join(' / ')}
                </span>
              )}
            </div>
          </div>
          {!readOnly && (
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <Button size="sm" onClick={saveEdits} disabled={saving}>
                  <Save className={`w-4 h-4 mr-1.5 ${saving ? 'animate-pulse' : ''}`} /> {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                  <X className="w-4 h-4 mr-1.5" /> Cancel
                </Button>
              </>
            ) : (
              <>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                    <Pencil className="w-4 h-4 mr-1.5" /> Edit
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
                  <Download className="w-4 h-4 mr-1.5" /> Export
                </Button>
                <Button variant="outline" size="sm" onClick={loadBase} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </>
            )}
          </div>
          )}
        </div>
        {readOnly ? (
          <PayPeriodPicker
            periodStart={periodStart}
            periodEnd={periodEnd}
            onChange={(start, end) => { setPeriodStart(start); setPeriodEnd(end); }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Period Start</Label><Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Period End</Label><Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="mt-1" /></div>
            <div>
              <Label className="text-xs">Branch</Label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branchOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Search Employee</Label><Input value={search} onChange={e => setSearch(e.target.value)} className="mt-1" placeholder="Name or department" /></div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{filteredEmployees.length} employees · {plottedCount} plotted cells in range</p>
          <ScheduleLegend shiftTemplates={shiftTemplates} />
        </div>
        {!readOnly && (
          <>
            <ReconcileBar
              showActual={showActual}
              onToggleActual={() => setShowActual(s => !s)}
            />
            <LeaveNotices notices={notices} />
          </>
        )}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading employees...</div>
        ) : (
          <ScheduleGrid
            employees={filteredEmployees}
            assignments={assignments}
            leaveOverlay={leaveOverlay}
            actualOverlay={actualOverlay}
            shiftTemplates={shiftTemplates}
            periodStart={periodStart}
            periodEnd={periodEnd}
            editable={editMode && canEdit}
            onChange={handleCellChange}
            onFillTo={handleFillTo}
            onEditEmployee={(!readOnly && canEdit && !editMode) ? setEditEmployee : undefined}
          />
        )}
      </div>

      {editEmployee && (
        <EmployeeScheduleEditModal
          employee={editEmployee}
          periodStart={periodStart}
          periodEnd={periodEnd}
          baseAssignments={baseAssignments}
          shiftTemplates={shiftTemplates}
          onClose={() => setEditEmployee(null)}
          onSave={saveEmployeeEdits}
        />
      )}
    </div>
  );
}
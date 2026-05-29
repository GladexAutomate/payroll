import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { CalendarCheck, RefreshCw, Download, Pencil, Save, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import ScheduleGrid from '@/components/schedule/ScheduleGrid';
import ScheduleLegend from '@/components/schedule/ScheduleLegend';
import LeaveNotices from '@/components/schedule/LeaveNotices';
import { getEmployeeName, getEmployeeSalary } from '@/components/schedule/scheduleUtils';
import { buildLeaveOverlay } from '@/components/schedule/leaveOverlay';
import { exportApprovedScheduleToExcel } from '@/components/schedule/exportApprovedSchedule';

export default function ApprovedSchedule() {
  const [periodStart, setPeriodStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(addDays(new Date(), 15), 'yyyy-MM-dd'));
  const [records, setRecords] = useState([]);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [plotted, setPlotted] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [localEmployees, setLocalEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadRange(); }, [periodStart, periodEnd]);

  const loadBase = async () => {
    setLoading(true);
    const [res, shifts, locals] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'list', pageSize: 100 }),
      base44.entities.ShiftTemplate.list(),
      base44.entities.Employee.list('-updated_date', 5000),
    ]);
    setRecords(res.data.records || []);
    setShiftTemplates(shifts || []);
    setLocalEmployees(locals || []);
    setLoading(false);
    loadRange();
  };

  const loadRange = async () => {
    const [plottedData, leaveData] = await Promise.all([
      base44.entities.ApprovedSchedule.filter({ date: { $gte: periodStart, $lte: periodEnd } }, '-date', 5000),
      base44.entities.LeaveRequest.filter({
        date_from: { $lte: periodEnd },
        date_to: { $gte: periodStart },
      }, '-date_from', 5000),
    ]);
    setPlotted(plottedData || []);
    setLeaves(leaveData || []);
  };

  const employees = useMemo(() => records.map(record => ({
    id: record.id,
    backend_id: record.backend_id,
    name: getEmployeeName(record),
    monthly_salary: getEmployeeSalary(record),
    department: record.fields?.Department || record.fields?.['Department Role'] || '',
  })), [records]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e => e.name.toLowerCase().includes(q) || (e.department || '').toLowerCase().includes(q));
  }, [employees, search]);

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

  const handleCellChange = (empId, date, type) => {
    setDraft(prev => ({ ...prev, [empId]: { ...(prev[empId] || {}), [date]: type } }));
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
            </div>
          </div>
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
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Pencil className="w-4 h-4 mr-1.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
                  <Download className="w-4 h-4 mr-1.5" /> Export
                </Button>
                <Button variant="outline" size="sm" onClick={loadBase} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label className="text-xs">Period Start</Label><Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Period End</Label><Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Search Employee</Label><Input value={search} onChange={e => setSearch(e.target.value)} className="mt-1" placeholder="Name or department" /></div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{filteredEmployees.length} employees · {plottedCount} plotted cells in range</p>
          <ScheduleLegend shiftTemplates={shiftTemplates} />
        </div>
        <LeaveNotices notices={notices} />
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading employees...</div>
        ) : (
          <ScheduleGrid
            employees={filteredEmployees}
            assignments={assignments}
            leaveOverlay={leaveOverlay}
            shiftTemplates={shiftTemplates}
            periodStart={periodStart}
            periodEnd={periodEnd}
            editable={editMode}
            onChange={handleCellChange}
          />
        )}
      </div>
    </div>
  );
}
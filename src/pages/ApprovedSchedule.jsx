import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { CalendarCheck, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import ScheduleGrid from '@/components/schedule/ScheduleGrid';
import ScheduleLegend from '@/components/schedule/ScheduleLegend';
import { getEmployeeName, getEmployeeSalary } from '@/components/schedule/scheduleUtils';

export default function ApprovedSchedule() {
  const [periodStart, setPeriodStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(addDays(new Date(), 15), 'yyyy-MM-dd'));
  const [records, setRecords] = useState([]);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [plotted, setPlotted] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadPlotted(); }, [periodStart, periodEnd]);

  const loadBase = async () => {
    setLoading(true);
    const [res, shifts] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'list', pageSize: 100 }),
      base44.entities.ShiftTemplate.list(),
    ]);
    setRecords(res.data.records || []);
    setShiftTemplates(shifts || []);
    setLoading(false);
    loadPlotted();
  };

  const loadPlotted = async () => {
    const data = await base44.entities.ApprovedSchedule.filter({
      date: { $gte: periodStart, $lte: periodEnd },
    }, '-date', 5000);
    setPlotted(data || []);
  };

  const employees = useMemo(() => records.map(record => ({
    id: record.id,
    name: getEmployeeName(record),
    monthly_salary: getEmployeeSalary(record),
    department: record.fields?.Department || record.fields?.['Department Role'] || '',
  })), [records]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e => e.name.toLowerCase().includes(q) || (e.department || '').toLowerCase().includes(q));
  }, [employees, search]);

  // Build assignments map from plotted records (key by employee_id)
  const assignments = useMemo(() => {
    const map = {};
    plotted.forEach(rec => {
      map[rec.employee_id] = map[rec.employee_id] || {};
      map[rec.employee_id][rec.date] = rec.schedule_type;
    });
    return map;
  }, [plotted]);

  const plottedCount = plotted.length;

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold">Approved Schedule</h2>
              <p className="text-xs text-muted-foreground">Blank schedule for all active employees — auto-plotted when a proposal is approved.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadBase} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
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
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading employees...</div>
        ) : (
          <ScheduleGrid
            employees={filteredEmployees}
            assignments={assignments}
            shiftTemplates={shiftTemplates}
            periodStart={periodStart}
            periodEnd={periodEnd}
          />
        )}
      </div>
    </div>
  );
}
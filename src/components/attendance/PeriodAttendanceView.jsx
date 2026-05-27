import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Search, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

/**
 * PeriodAttendanceView
 * Renders a per-employee attendance summary grid for a date range.
 * Used for cut-off (1-15, 16-end) and monthly views.
 */
export default function PeriodAttendanceView({ startDate, endDate, periodLabel }) {
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      // Fetch all logs in the date range. Filter API supports $gte/$lte.
      const [logsData, empsData] = await Promise.all([
        base44.entities.AttendanceLog.filter(
          { date: { $gte: startDate, $lte: endDate } },
          'date',
          5000
        ),
        base44.entities.Employee.filter({ status: 'active' }, 'last_name', 1000),
      ]);
      if (cancelled) return;
      setLogs(logsData);
      setEmployees(empsData);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const days = useMemo(
    () => eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }),
    [startDate, endDate]
  );

  // Group logs by employee key, then by date
  const grid = useMemo(() => {
    const byEmp = {};
    for (const log of logs) {
      const key = log.employee_id || log.biometric_id;
      if (!key) continue;
      if (!byEmp[key]) byEmp[key] = {};
      byEmp[key][log.date] = log;
    }
    return byEmp;
  }, [logs]);

  const empMap = useMemo(() => {
    const m = {};
    for (const e of employees) {
      if (e.id) m[e.id] = e;
      if (e.employee_id) m[e.employee_id] = e;
      if (e.biometric_id) m[e.biometric_id] = e;
    }
    return m;
  }, [employees]);

  // Build display rows: one per employee key seen in logs
  const rows = useMemo(() => {
    const keys = Object.keys(grid);
    const items = keys.map(key => {
      const emp = empMap[key];
      const name = emp
        ? `${emp.first_name} ${emp.last_name}`.trim()
        : (Object.values(grid[key])[0]?.employee_name || key);
      return { key, emp, name, logs: grid[key] };
    });
    items.sort((a, b) => a.name.localeCompare(b.name));
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.key || '').toLowerCase().includes(q)
    );
  }, [grid, empMap, search]);

  const fmtTime = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(String(iso).split(' ')[0]);
      if (isNaN(d.getTime())) return '';
      return format(d, 'HH:mm');
    } catch { return ''; }
  };

  const cellContent = (log) => {
    if (!log) return <span className="text-muted-foreground/40">—</span>;
    const tIn = fmtTime(log.time_in);
    const tOut = fmtTime(log.time_out);
    if (!tIn && !tOut) {
      // No times but a status (absent/leave/holiday/rest)
      const s = log.status?.[0]?.toUpperCase() || '—';
      return <span className="text-xs text-muted-foreground">{s}</span>;
    }
    return (
      <div className="leading-tight">
        <div className="text-[11px] font-mono">{tIn || '—'}</div>
        <div className="text-[11px] font-mono text-muted-foreground">{tOut || '—'}</div>
      </div>
    );
  };

  const summarize = (empLogs) => {
    let present = 0, absent = 0, hours = 0, late = 0;
    for (const d of days) {
      const ds = format(d, 'yyyy-MM-dd');
      const l = empLogs[ds];
      if (!l) continue;
      if (l.status === 'present') present++;
      else if (l.status === 'absent') absent++;
      hours += Number(l.total_hours) || 0;
      late += Number(l.late_minutes) || 0;
    }
    return { present, absent, hours, late };
  };

  const exportToExcel = () => {
    const header = ['Employee', 'ID', ...days.map(d => format(d, 'MM-dd')), 'Days Present', 'Total Hours', 'Late (min)'];
    const data = rows.map(r => {
      const s = summarize(r.logs);
      return [
        r.name,
        r.key,
        ...days.map(d => {
          const log = r.logs[format(d, 'yyyy-MM-dd')];
          if (!log) return '';
          const tIn = fmtTime(log.time_in);
          const tOut = fmtTime(log.time_out);
          if (!tIn && !tOut) return log.status || '';
          return `${tIn || ''} / ${tOut || ''}`;
        }),
        s.present,
        s.hours.toFixed(1),
        s.late,
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws['!cols'] = [{ wch: 24 }, { wch: 10 }, ...days.map(() => ({ wch: 11 })), { wch: 12 }, { wch: 12 }, { wch: 11 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, periodLabel.slice(0, 30));
    XLSX.writeFile(wb, `Attendance_${periodLabel.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{periodLabel}</strong> · {days.length} days · {rows.length} employees
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={loading || rows.length === 0}>
            <Download className="w-4 h-4 mr-1.5" /> Export Excel
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="sticky left-0 z-20 bg-muted text-left py-2.5 px-3 font-medium text-muted-foreground uppercase tracking-wide border-b border-r border-border min-w-[200px]">
                  Employee
                </th>
                {days.map(d => (
                  <th
                    key={d.toISOString()}
                    className="py-2 px-2 font-medium text-center text-muted-foreground border-b border-border min-w-[60px]"
                  >
                    <div className="text-[10px]">{format(d, 'EEE')}</div>
                    <div className="text-xs font-semibold text-foreground">{format(d, 'd')}</div>
                  </th>
                ))}
                <th className="py-2 px-3 font-medium text-center text-muted-foreground border-b border-l border-border min-w-[60px]">
                  Days
                </th>
                <th className="py-2 px-3 font-medium text-center text-muted-foreground border-b border-border min-w-[70px]">
                  Hours
                </th>
                <th className="py-2 px-3 font-medium text-center text-muted-foreground border-b border-border min-w-[60px]">
                  Late
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={days.length + 4} className="text-center py-12 text-muted-foreground">
                    Loading attendance records...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 4} className="text-center py-12 text-muted-foreground">
                    No attendance records found for this period.
                  </td>
                </tr>
              ) : rows.map(r => {
                const s = summarize(r.logs);
                return (
                  <tr key={r.key} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-card hover:bg-muted/20 py-2 px-3 border-r border-border">
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">{r.key}</p>
                    </td>
                    {days.map(d => {
                      const ds = format(d, 'yyyy-MM-dd');
                      const log = r.logs[ds];
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <td
                          key={ds}
                          className={`py-1.5 px-1 text-center border-r border-border/30 ${
                            isWeekend ? 'bg-muted/30' : ''
                          }`}
                        >
                          {cellContent(log)}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-3 text-center font-semibold text-green-700 border-l border-border">
                      {s.present}
                    </td>
                    <td className="py-1.5 px-3 text-center font-mono text-xs">
                      {s.hours.toFixed(1)}h
                    </td>
                    <td className="py-1.5 px-3 text-center text-orange-600 text-xs">
                      {s.late > 0 ? `${s.late}m` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
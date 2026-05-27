import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Search, Download, X } from 'lucide-react';
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
      return <span className="text-muted-foreground/40">—</span>;
    }
    return (
      <div className="leading-tight">
        <div className="text-[11px] font-mono">{tIn || '—'}</div>
        <div className="text-[11px] font-mono text-muted-foreground">{tOut || '—'}</div>
      </div>
    );
  };

  const [editCell, setEditCell] = useState(null); // { row, dateStr, log }

  const reloadLogs = async () => {
    const logsData = await base44.entities.AttendanceLog.filter(
      { date: { $gte: startDate, $lte: endDate } },
      'date',
      5000
    );
    setLogs(logsData);
  };

  const savePunch = async ({ timeIn, timeOut }) => {
    const { row, dateStr, log } = editCell;
    const buildISO = (t) => t ? `${dateStr}T${t}:00` : null;
    const timeInISO = buildISO(timeIn);
    const timeOutISO = buildISO(timeOut);
    const totalHours = timeInISO && timeOutISO
      ? Math.round((new Date(timeOutISO) - new Date(timeInISO)) / 36000) / 100
      : 0;

    if (log) {
      await base44.entities.AttendanceLog.update(log.id, {
        time_in: timeInISO,
        time_out: timeOutISO,
        total_hours: totalHours,
        is_manually_edited: true,
        status: 'present',
      });
    } else {
      await base44.entities.AttendanceLog.create({
        employee_id: row.emp?.id || row.key,
        biometric_id: row.emp?.biometric_id || row.key,
        employee_name: row.name,
        date: dateStr,
        time_in: timeInISO,
        time_out: timeOutISO,
        raw_punches: [timeInISO, timeOutISO].filter(Boolean),
        total_hours: totalHours,
        status: 'present',
        is_manually_edited: true,
      });
    }
    setEditCell(null);
    await reloadLogs();
  };

  const summarize = (empLogs) => {
    let present = 0, absent = 0, hours = 0, ot = 0, late = 0;
    for (const d of days) {
      const ds = format(d, 'yyyy-MM-dd');
      const l = empLogs[ds];
      if (!l) continue;
      // Only count as a worked day if BOTH time in and time out are present
      if (l.time_in && l.time_out) {
        present++;
        // Compute raw hours from time_in/time_out
        const raw = (new Date(l.time_out) - new Date(l.time_in)) / 3600000;
        if (!isNaN(raw) && raw > 0) {
          const dayHours = Math.max(1, Math.min(8, raw));
          hours += dayHours;
          // OT only counts in whole hours, minimum 1h (e.g. 1h30m = 1, 2h20m = 2)
          const extra = raw - 8;
          if (extra >= 1) ot += Math.floor(extra);
        }
      } else if (l.status === 'absent') {
        absent++;
      }
      late += Number(l.late_minutes) || 0;
    }
    return { present, absent, hours, ot, late };
  };

  const exportToExcel = () => {
    const header = ['Employee', 'ID', ...days.map(d => format(d, 'MM-dd')), 'Days Present', 'Total Hours', 'OT Hours', 'Late (min)'];
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
        s.ot.toFixed(1),
        s.late,
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws['!cols'] = [{ wch: 24 }, { wch: 10 }, ...days.map(() => ({ wch: 11 })), { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 11 }];
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
                  OT
                </th>
                <th className="py-2 px-3 font-medium text-center text-muted-foreground border-b border-border min-w-[60px]">
                  Late
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={days.length + 5} className="text-center py-12 text-muted-foreground">
                    Loading attendance records...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 5} className="text-center py-12 text-muted-foreground">
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
                          onClick={() => setEditCell({ row: r, dateStr: ds, log })}
                          className={`py-1.5 px-1 text-center border-r border-border/30 cursor-pointer hover:bg-primary/10 ${
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
                    <td className="py-1.5 px-3 text-center font-mono text-xs text-blue-600">
                      {s.ot > 0 ? `${s.ot.toFixed(1)}h` : '—'}
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

      {editCell && (
        <PunchEditModal
          row={editCell.row}
          dateStr={editCell.dateStr}
          log={editCell.log}
          onClose={() => setEditCell(null)}
          onSave={savePunch}
        />
      )}
    </div>
  );
}

function PunchEditModal({ row, dateStr, log, onClose, onSave }) {
  const initTime = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(String(iso).split(' ')[0]);
      if (isNaN(d.getTime())) return '';
      return format(d, 'HH:mm');
    } catch { return ''; }
  };
  const [timeIn, setTimeIn] = useState(initTime(log?.time_in));
  const [timeOut, setTimeOut] = useState(initTime(log?.time_out));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ timeIn, timeOut });
  };

  const handleClear = async () => {
    setSaving(true);
    await onSave({ timeIn: '', timeOut: '' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-sm">Manual Punch Record</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {row.name} · {format(parseISO(dateStr), 'EEE, MMM d yyyy')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Time In</label>
              <Input type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Time Out</label>
              <Input type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} className="mt-1" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Manually entered records will be marked as edited and override any imported values for this day.
          </p>
        </div>
        <div className="flex justify-between gap-2 px-5 pb-5">
          {log && (
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={saving} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              Clear
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Filter, Pencil, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import { format, getDaysInMonth } from 'date-fns';
import PeriodAttendanceView from '@/components/attendance/PeriodAttendanceView';

export default function Attendance() {
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'cutoff' | 'monthly'
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [periodMonth, setPeriodMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [cutoffHalf, setCutoffHalf] = useState('first'); // 'first' (1-15) | 'second' (16-end)
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingLog, setEditingLog] = useState(null);

  useEffect(() => { if (viewMode === 'daily') loadData(); }, [filterDate, viewMode]);

  // Compute cut-off / monthly period
  const [py, pm] = periodMonth.split('-').map(Number);
  const lastDay = getDaysInMonth(new Date(py, pm - 1));
  const monthLabel = format(new Date(py, pm - 1, 1), 'MMMM yyyy');
  let periodStart, periodEnd, periodLabel;
  if (viewMode === 'monthly') {
    periodStart = `${periodMonth}-01`;
    periodEnd = `${periodMonth}-${String(lastDay).padStart(2, '0')}`;
    periodLabel = monthLabel;
  } else {
    if (cutoffHalf === 'first') {
      periodStart = `${periodMonth}-01`;
      periodEnd = `${periodMonth}-15`;
      periodLabel = `${monthLabel} (1-15)`;
    } else {
      periodStart = `${periodMonth}-16`;
      periodEnd = `${periodMonth}-${String(lastDay).padStart(2, '0')}`;
      periodLabel = `${monthLabel} (16-${lastDay})`;
    }
  }

  const loadData = async () => {
    setLoading(true);
    const [logsData, empsData, hiddenUploads] = await Promise.all([
      base44.entities.AttendanceLog.filter({ date: filterDate }),
      base44.entities.Employee.filter({ status: 'active' }),
      base44.entities.AttendanceUpload.list('-created_date', 200)
    ]);
    const activeUploadIds = new Set(hiddenUploads.filter(upload => !['deleting', 'deleted'].includes(upload.status)).map(upload => upload.id));
    setLogs(logsData.filter(log => !log.upload_id || activeUploadIds.has(log.upload_id)));
    setEmployees(empsData);
    setLoading(false);
  };

  const empMap = employees.reduce((m, e) => ({ ...m, [e.id]: e, [e.biometric_id]: e }), {});

  const filtered = logs.filter(l => {
    const emp = empMap[l.employee_id] || empMap[l.biometric_id];
    const name = emp
      ? `${emp.first_name} ${emp.last_name}`.toLowerCase()
      : (l.employee_name || l.employee_id || '').toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || (l.biometric_id || '').includes(search);
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const saveEdit = async (data) => {
    await base44.entities.AttendanceLog.update(editingLog.id, { ...data, is_manually_edited: true });
    setEditingLog(null);
    loadData();
  };

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try {
      // Only accept clean ISO datetime strings like "2026-05-27T08:00:00"
      const clean = String(iso).trim().split(' ')[0];
      const d = new Date(clean);
      if (isNaN(d.getTime())) return '—';
      return format(d, 'hh:mm a');
    } catch { return '—'; }
  };
  const fmtHrs = (h) => (h != null && !isNaN(h)) ? `${Number(h).toFixed(1)}h` : '—';

  return (
    <div className="space-y-5">
      {/* View Mode Tabs */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
        {[
          { key: 'daily', label: 'Daily' },
          { key: 'cutoff', label: 'Cut-off' },
          { key: 'monthly', label: 'Monthly' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setViewMode(t.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Daily controls */}
      {viewMode === 'daily' && (
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="w-40"
        />
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card"
        >
          <option value="all">All Status</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="half_day">Half Day</option>
          <option value="on_leave">On Leave</option>
        </select>
        <Button variant="outline" size="sm" onClick={loadData}>
          <Filter className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>
      )}

      {/* Period controls (cutoff / monthly) */}
      {viewMode !== 'daily' && (
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="month"
            value={periodMonth}
            onChange={e => setPeriodMonth(e.target.value)}
            className="w-44"
          />
          {viewMode === 'cutoff' && (
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              <button
                onClick={() => setCutoffHalf('first')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  cutoffHalf === 'first' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                1st Half (1-15)
              </button>
              <button
                onClick={() => setCutoffHalf('second')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  cutoffHalf === 'second' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                2nd Half (16-{lastDay})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Period view */}
      {viewMode !== 'daily' && (
        <PeriodAttendanceView
          key={`${periodStart}-${periodEnd}`}
          startDate={periodStart}
          endDate={periodEnd}
          periodLabel={periodLabel}
        />
      )}

      {viewMode === 'daily' && <>


      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Present', status: 'present', color: 'text-green-600' },
          { label: 'Absent', status: 'absent', color: 'text-red-600' },
          { label: 'Late', status: 'late', color: 'text-orange-600' },
          { label: 'On Leave', status: 'on_leave', color: 'text-blue-600' },
        ].map(({ label, status, color }) => (
          <div key={status} className="bg-card border border-border rounded-xl p-3.5 text-center">
            <p className={`text-2xl font-bold ${color}`}>
              {logs.filter(l => l.status === status).length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Time In</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Time Out</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Hours</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Late</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(7)].map((_, j) => <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No records for this date.</td></tr>
              ) : filtered.map(log => {
                const emp = empMap[log.employee_id] || empMap[log.biometric_id];
                return (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-medium">
                          {emp ? `${emp.first_name} ${emp.last_name}` : (log.employee_name || log.employee_id)}
                          {log.is_manually_edited && <span className="ml-2 text-xs text-orange-600">(edited)</span>}
                        </p>
                        {emp?.employee_id && (
                          <p className="text-xs text-muted-foreground">{emp.employee_id}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-sm">{fmtTime(log.time_in)}</td>
                    <td className="py-3.5 px-4 font-mono text-sm">{fmtTime(log.time_out)}</td>
                    <td className="py-3.5 px-4">{fmtHrs(log.total_hours)}</td>
                    <td className="py-3.5 px-4">
                      {log.late_minutes > 0 ? (
                        <span className="text-orange-600 font-medium text-xs">{log.late_minutes}m</span>
                      ) : '—'}
                    </td>
                    <td className="py-3.5 px-4"><StatusBadge status={log.status} /></td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setEditingLog(log)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingLog && (
        <EditLogModal log={editingLog} onSave={saveEdit} onClose={() => setEditingLog(null)} />
      )}
      </>}
    </div>
  );
}

function EditLogModal({ log, onSave, onClose }) {
  const [form, setForm] = useState({
    time_in: log.time_in ? log.time_in.slice(0, 16) : '',
    time_out: log.time_out ? log.time_out.slice(0, 16) : '',
    status: log.status || 'present',
    late_minutes: log.late_minutes || 0,
    overtime_minutes: log.overtime_minutes || 0,
    remarks: log.remarks || ''
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Edit Attendance Record</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><Clock className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Time In</label>
              <Input type="datetime-local" value={form.time_in} onChange={e => set('time_in', e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Time Out</label>
              <Input type="datetime-local" value={form.time_out} onChange={e => set('time_out', e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-card">
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half Day</option>
              <option value="on_leave">On Leave</option>
              <option value="holiday">Holiday</option>
              <option value="rest_day">Rest Day</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Late (minutes)</label>
              <Input type="number" value={form.late_minutes} onChange={e => set('late_minutes', parseInt(e.target.value) || 0)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Overtime (minutes)</label>
              <Input type="number" value={form.overtime_minutes} onChange={e => set('overtime_minutes', parseInt(e.target.value) || 0)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Remarks</label>
            <Input value={form.remarks} onChange={e => set('remarks', e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </div>
      </div>
    </div>
  );
}
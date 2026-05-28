import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Clock, DollarSign, AlertTriangle, UserCheck, UserX, CalendarOff, TrendingUp } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({ employees: 0, present: 0, absent: 0, onLeave: 0, pendingLeaves: 0, pendingOT: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [employeeMap, setEmployeeMap] = useState({});
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    const [employees, todayLogsRaw, pendingLeaves, pendingOT, hiddenUploads] = await Promise.all([
      base44.entities.Employee.filter({ status: 'active' }),
      base44.entities.AttendanceLog.filter({ date: today }),
      base44.entities.LeaveRequest.filter({ status: 'pending' }),
      base44.entities.OvertimeRequest.filter({ status: 'pending' }),
      base44.entities.AttendanceUpload.filter({ status: 'deleting' }),
    ]);
    const hiddenUploadIds = new Set(hiddenUploads.map(upload => upload.id));
    const todayLogs = todayLogsRaw.filter(log => !hiddenUploadIds.has(log.upload_id));

    const present = todayLogs.filter(l => l.status === 'present').length;
    const absent = todayLogs.filter(l => l.status === 'absent').length;
    const onLeave = todayLogs.filter(l => l.status === 'on_leave').length;

    setStats({
      employees: employees.length,
      present,
      absent,
      onLeave,
      pendingLeaves: pendingLeaves.length,
      pendingOT: pendingOT.length,
    });
    // Build a lookup map: try id, employee_id, biometric_id → full name
    const map = {};
    for (const emp of employees) {
      const fullName = `${emp.first_name} ${emp.last_name}`.trim();
      if (emp.id) map[emp.id] = fullName;
      if (emp.employee_id) map[emp.employee_id] = fullName;
      if (emp.biometric_id) map[emp.biometric_id] = fullName;
    }
    setEmployeeMap(map);
    setRecentLogs(todayLogs.slice(0, 8));
    setLoading(false);
  };

  const getEmployeeName = (log) => {
    return log.employee_name
      || employeeMap[log.employee_id]
      || employeeMap[log.biometric_id]
      || log.employee_id
      || 'Unknown';
  };

  const attendanceData = [
    { name: 'Present', value: stats.present, fill: '#22c55e' },
    { name: 'Absent', value: stats.absent, fill: '#ef4444' },
    { name: 'On Leave', value: stats.onLeave, fill: '#3b82f6' },
    { name: 'Unknown', value: Math.max(0, stats.employees - stats.present - stats.absent - stats.onLeave), fill: '#9ca3af' },
  ];

  return (
    <div className="space-y-6">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Today's workforce overview</p>
        </div>
        <button
          onClick={loadDashboard}
          className="text-xs text-primary hover:underline font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Employees" value={loading ? '—' : stats.employees} subtitle="Active employees" icon={Users} color="blue" />
        <StatCard title="Present Today" value={loading ? '—' : stats.present} subtitle={`${stats.employees > 0 ? Math.round(stats.present / stats.employees * 100) : 0}% attendance rate`} icon={UserCheck} color="green" />
        <StatCard title="Absent Today" value={loading ? '—' : stats.absent} subtitle="Did not clock in" icon={UserX} color="red" />
        <StatCard title="On Leave" value={loading ? '—' : stats.onLeave} subtitle="Approved leaves today" icon={CalendarOff} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard title="Pending Leave Requests" value={loading ? '—' : stats.pendingLeaves} subtitle="Awaiting approval" icon={AlertTriangle} color="orange" />
        <StatCard title="Pending Overtime" value={loading ? '—' : stats.pendingOT} subtitle="Awaiting approval" icon={Clock} color="purple" />
        <StatCard title="Payroll Due" value="May 31" subtitle="Next payroll release date" icon={DollarSign} color="green" />
      </div>

      {/* Charts + Today's attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance breakdown */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-4">Today's Attendance Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attendanceData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {attendanceData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent attendance logs */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-4">Recent Clock-ins Today</h3>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No attendance records for today yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map(log => {
                const name = getEmployeeName(log);
                return (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs text-primary font-semibold">{(name || 'E')[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.time_in ? (() => { try { const d = new Date(log.time_in); return isNaN(d) ? log.time_in : format(d, 'hh:mm a'); } catch { return log.time_in; } })() : '—'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    log.status === 'present' ? 'bg-green-50 text-green-700' :
                    log.status === 'late' ? 'bg-orange-50 text-orange-700' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {log.status}
                  </span>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
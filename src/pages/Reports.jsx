import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Download, BarChart2, Users, Calendar, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function Reports() {
  const [attendanceSummary, setAttendanceSummary] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState([]);
  const [dateFrom, setDateFrom] = useState('2026-05-01');
  const [dateTo, setDateTo] = useState('2026-05-31');
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState('attendance');

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    setLoading(true);
    const [logs, runs, records, employees] = await Promise.all([
      base44.entities.AttendanceLog.list('-date', 500),
      base44.entities.PayrollRun.list('-period_start', 10),
      base44.entities.PayrollRecord.list('-created_date', 200),
      base44.entities.Employee.filter({ status: 'active' }),
    ]);

    // Attendance by status
    const statusCounts = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0 };
    logs.filter(l => l.date >= dateFrom && l.date <= dateTo).forEach(l => {
      if (statusCounts[l.status] !== undefined) statusCounts[l.status]++;
    });
    setAttendanceSummary(Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace('_', ' '), value })));

    // Payroll summary by run
    const pSummary = runs.slice(0, 6).map(run => {
      const runRecs = records.filter(r => r.payroll_run_id === run.id);
      return {
        name: run.period_label?.slice(0, 10),
        gross: run.total_gross || 0,
        net: run.total_net || 0,
        deductions: run.total_deductions || 0,
      };
    }).reverse();
    setPayrollSummary(pSummary);

    setLoading(false);
  };

  const COLORS = ['#22c55e', '#ef4444', '#f97316', '#eab308', '#3b82f6'];

  const reports = [
    { id: 'attendance', label: 'Attendance Summary', icon: Calendar },
    { id: 'payroll', label: 'Payroll Register', icon: DollarSign },
    { id: 'contributions', label: 'Gov\'t Contributions', icon: Users },
  ];

  return (
    <div className="space-y-5">
      {/* Report Tabs */}
      <div className="flex flex-wrap gap-2">
        {reports.map(r => (
          <button
            key={r.id}
            onClick={() => setActiveReport(r.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${activeReport === r.id ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            <r.icon className="w-4 h-4" /> {r.label}
          </button>
        ))}
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">From:</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">To:</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={loadReports} size="sm" disabled={loading}>
          {loading ? 'Loading...' : 'Generate'}
        </Button>
      </div>

      {/* Attendance Report */}
      {activeReport === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Attendance by Status</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={attendanceSummary} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {attendanceSummary.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Attendance Count</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendanceSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Payroll Report */}
      {activeReport === 'payroll' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Payroll Trend (Last 6 Runs)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={payrollSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="gross" name="Gross Pay" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net Pay" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deductions" name="Deductions" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Government Contributions */}
      {activeReport === 'contributions' && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-1">Government Contributions Summary</h3>
          <p className="text-xs text-muted-foreground mb-4">Based on latest payroll run</p>
          <ContributionsSummary />
        </div>
      )}
    </div>
  );
}

function ContributionsSummary() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [runs, records, employees] = await Promise.all([
        base44.entities.PayrollRun.filter({ status: 'approved' }),
        base44.entities.PayrollRecord.list('-created_date', 200),
        base44.entities.Employee.filter({ status: 'active' }),
      ]);
      if (!runs.length) { setLoading(false); return; }
      const latestRun = runs.sort((a, b) => b.period_start?.localeCompare(a.period_start || '') || 0)[0];
      const runRecs = records.filter(r => r.payroll_run_id === latestRun?.id);
      const empMap = employees.reduce((m, e) => ({ ...m, [e.id]: e }), {});
      setData(runRecs.map(r => ({
        name: empMap[r.employee_id] ? `${empMap[r.employee_id].first_name} ${empMap[r.employee_id].last_name}` : r.employee_id,
        sss: r.sss_employee + r.sss_employer,
        philhealth: r.philhealth_employee + r.philhealth_employer,
        pagibig: r.pagibig_employee + r.pagibig_employer,
        tax: r.withholding_tax,
      })));
      setLoading(false);
    };
    load();
  }, []);

  const fmt = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  if (loading) return <div className="h-20 bg-muted rounded animate-pulse" />;
  if (!data.length) return <p className="text-muted-foreground text-sm">No approved payroll runs found.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Employee</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">SSS (Total)</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">PhilHealth</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Pag-IBIG</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Withholding Tax</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
              <td className="py-2.5 px-3 font-medium">{row.name}</td>
              <td className="py-2.5 px-3 text-right text-xs">{fmt(row.sss)}</td>
              <td className="py-2.5 px-3 text-right text-xs">{fmt(row.philhealth)}</td>
              <td className="py-2.5 px-3 text-right text-xs">{fmt(row.pagibig)}</td>
              <td className="py-2.5 px-3 text-right text-xs">{fmt(row.tax)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
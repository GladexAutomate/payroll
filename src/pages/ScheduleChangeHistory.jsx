import { useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, ArrowRight, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fmtDateTime, fmtDate } from '@/lib/dateFormat';

export default function ScheduleChangeHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ScheduleChangeLog.list('-created_date', 1000);
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(l =>
      (l.employee_name || '').toLowerCase().includes(q) ||
      (l.changed_by || '').toLowerCase().includes(q) ||
      (l.date || '').includes(q)
    );
  }, [logs, search]);

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold">Schedule Change History</h2>
              <p className="text-xs text-muted-foreground">Every approved-schedule edit — who changed it, when, and what changed.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Employee, editor or date" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">When</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Change</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Changed By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(5)].map((_, j) => <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No schedule changes recorded yet.</td></tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{fmtDateTime(log.created_date)}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium">{log.employee_name || '—'}</p>
                    {log.department && <p className="text-xs text-muted-foreground">{log.department}</p>}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{fmtDate(log.date)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{log.old_label || log.old_value || 'No Sched'}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">{log.new_label || log.new_value || 'No Sched'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{log.changed_by || 'Unknown'}</span>
                    </div>
                    {log.changed_by_role && <p className="text-xs text-muted-foreground capitalize ml-5">{log.changed_by_role}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
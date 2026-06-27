import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getAppEnv } from '@/lib/appEnv';
import { Button } from '@/components/ui/button';

const STATUS = {
  success: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: 'Healthy' },
  partial: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Partial' },
  error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Failed' },
};

const timeAgo = (iso) => {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

export default function SyncStatusBanner() {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const res = await base44.functions.invoke('airtableEmployees', { action: 'syncStatus' });
    setLog(res.data?.lastSync || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true);
    // Push the Base44 database (the source of truth) to Supabase. Changes already sync
    // in real time on every edit; this is a manual full sweep.
    await base44.functions.invoke('syncToSupabase', { env: getAppEnv() }).catch(() => {});
    setRunning(false);
    load();
  };

  if (loading) return null;

  const cfg = STATUS[log?.status] || { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/40 border-border', label: 'No runs yet' };
  const Icon = cfg.icon;
  const tableCount = log?.summary ? Object.keys(log.summary).length : 0;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${cfg.bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${cfg.color}`} />
        <div>
          <p className="text-sm font-medium">
            Data sync: {cfg.label}
            {log && <span className="text-muted-foreground font-normal"> · last run {timeAgo(log.finished_at || log.created_date)}</span>}
          </p>
          {log && (
            <p className="text-xs text-muted-foreground">
              {log.total_synced ?? 0} records synced
              {tableCount ? ` across ${tableCount} entities` : ''}
              {log.error_count ? ` · ${log.error_count} error(s)` : ' · 0 errors'}
              {log.duration_ms ? ` · ${(log.duration_ms / 1000).toFixed(1)}s` : ''}
            </p>
          )}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={runNow} disabled={running}>
        <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} /> {running ? 'Syncing...' : 'Sync now'}
      </Button>
    </div>
  );
}
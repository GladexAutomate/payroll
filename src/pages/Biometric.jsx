import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Fingerprint, RefreshCw, CheckCircle, XCircle, AlertTriangle, Wifi, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';

export default function Biometric() {
  const [config, setConfig] = useState({ device_ip: '112.209.71.138', device_port: 80, username: 'admin', password: '' });
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSyncLogs(); }, []);

  const loadSyncLogs = async () => {
    setLoading(true);
    const logs = await base44.entities.BiometricSyncLog.list('-sync_time', 20);
    setSyncLogs(logs);
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    const res = await base44.functions.invoke('syncBiometric', config);
    setResult(res.data);
    setSyncing(false);
    loadSyncLogs();
  };

  return (
    <div className="space-y-6">
      {/* Device Info Card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Fingerprint className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-semibold text-lg">AIFACE11 Device</h2>
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">AI Dynamic Face Attendance Machine · Serial: ZXRC21016060</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Wifi className="w-3.5 h-3.5" /> {config.device_ip}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Settings */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Connection Settings</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Device IP Address</Label>
                <Input value={config.device_ip} onChange={e => setConfig(p => ({ ...p, device_ip: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Port</Label>
                <Input value={config.device_port} type="number" onChange={e => setConfig(p => ({ ...p, device_port: parseInt(e.target.value) }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Username</Label>
              <Input value={config.username} onChange={e => setConfig(p => ({ ...p, username: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input type="password" value={config.password} onChange={e => setConfig(p => ({ ...p, password: e.target.value }))} className="mt-1" placeholder="Device admin password" />
            </div>
          </div>
          
          <Button onClick={handleSync} disabled={syncing} className="w-full mt-4">
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing Attendance Data...' : 'Sync Attendance Now'}
          </Button>

          {result && (
            <div className={`mt-4 rounded-lg p-4 flex items-start gap-3 ${result.error ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
              {result.error ? (
                <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`text-sm font-medium ${result.error ? 'text-orange-800' : 'text-green-800'}`}>
                  {result.error ? 'Sync Note' : 'Sync Successful'}
                </p>
                <p className={`text-xs mt-1 ${result.error ? 'text-orange-700' : 'text-green-700'}`}>
                  {result.message}
                </p>
                {result.records_fetched > 0 && (
                  <p className="text-xs text-green-700 mt-0.5">
                    Fetched: {result.records_fetched} · Saved: {result.records_saved}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Network Note */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800 font-medium mb-1">📡 Network Requirement</p>
            <p className="text-xs text-blue-700">
              Direct TCP/HTTP access to the device IP requires this app's server to be on the same network or the device's port to be forwarded. If sync fails, use the ZKBioTime software to export attendance logs and import them manually.
            </p>
          </div>
        </div>

        {/* Sync History */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-4">Sync History</h3>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
            </div>
          ) : syncLogs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No sync history yet.</div>
          ) : (
            <div className="space-y-2">
              {syncLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                  {log.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  ) : log.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {log.records_fetched || 0} fetched · {log.records_saved || 0} saved
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {log.sync_time ? format(new Date(log.sync_time), 'MMM d, yyyy h:mm a') : '—'} · {log.triggered_by}
                    </p>
                  </div>
                  <StatusBadge status={log.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
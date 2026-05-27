import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Fingerprint, CheckCircle, XCircle, AlertTriangle, Wifi, Copy, Check } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { format, differenceInMinutes } from 'date-fns';

const FUNCTION_URL = 'https://api.base44.com/api/apps/6a1686805d8389bea4666b9d/functions/syncBiometric';

export default function Biometric() {
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadSyncLogs(); }, []);

  const loadSyncLogs = async () => {
    setLoading(true);
    const logs = await base44.entities.BiometricSyncLog.list('-sync_time', 20);
    setSyncLogs(logs);
    setLoading(false);
  };

  // Determine online status: last successful push within 60 minutes
  const lastSuccess = syncLogs.find(l => l.status === 'success' && l.triggered_by === 'device_push');
  const isOnline = lastSuccess && differenceInMinutes(new Date(), new Date(lastSuccess.sync_time)) < 60;
  const lastSeen = lastSuccess ? format(new Date(lastSuccess.sync_time), 'MMM d, h:mm a') : null;

  const copyUrl = () => {
    navigator.clipboard.writeText(FUNCTION_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Device Status Card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Fingerprint className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-semibold text-lg">AIFACE11 Device</h2>
              {isOnline ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {lastSeen ? `Last seen ${lastSeen}` : 'Not connected'}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">AI Dynamic Face Attendance Machine · Serial: ZXRC21016060</p>
            {lastSeen && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Wifi className="w-3.5 h-3.5" />
                Last push received: {lastSeen} · from {lastSuccess?.device_ip}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Configuration Guide */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-sm">📡 Device Setup (Push Mode)</h3>
            <p className="text-xs text-muted-foreground mt-1">Configure the AIFACE11 to push attendance records to this app automatically.</p>
          </div>

          {/* Server URL to enter on device */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Step 1 — Copy this Server URL</p>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
              <code className="text-xs flex-1 break-all text-foreground">{FUNCTION_URL}</code>
              <button onClick={copyUrl} className="shrink-0 p-1 rounded hover:bg-border transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            </div>
          </div>

          {/* Steps */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Step 2 — Enter it on the device</p>
            <ol className="space-y-2">
              {[
                'On the device touchscreen: Menu → Comm → Cloud Server Settings',
                'Set Server Mode = ADMS',
                'Paste the Server URL above into the Server Address field',
                'Set Server Port = 443',
                'Enable Push Attendance Data = ON',
                'Save and reboot the device',
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs">
                  <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">{i + 1}</span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800 font-medium">✅ Once configured</p>
            <p className="text-xs text-blue-700 mt-0.5">
              The device will push every clock-in/out directly to this app. The device status above will show "Online" within 1 hour of the first successful push.
            </p>
          </div>
        </div>

        {/* Sync History */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Push History</h3>
            <button onClick={loadSyncLogs} className="text-xs text-primary hover:underline">Refresh</button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
            </div>
          ) : syncLogs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No pushes received yet.<br />
              <span className="text-xs">Configure the device using the guide on the left.</span>
            </div>
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
                      {log.records_fetched || 0} records · {log.records_saved || 0} new
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {log.sync_time ? format(new Date(log.sync_time), 'MMM d, yyyy h:mm a') : '—'}
                      {log.device_ip && ` · ${log.device_ip}`}
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
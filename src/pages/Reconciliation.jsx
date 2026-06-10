import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import RunReconcileCard from '@/components/reconciliation/RunReconcileCard';
import ReconcileHistoryTable from '@/components/reconciliation/ReconcileHistoryTable';
import ReconcileResultModal from '@/components/reconciliation/ReconcileResultModal';

const getCurrentPayPeriod = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const isFirstHalf = today.getDate() <= 15;
  const start = new Date(year, month, isFirstHalf ? 1 : 16);
  const end = isFirstHalf ? new Date(year, month, 15) : new Date(year, month + 1, 0);
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
};

export default function Reconciliation() {
  const period = useMemo(() => getCurrentPayPeriod(), []);
  const [periodStart, setPeriodStart] = useState(period.start);
  const [periodEnd, setPeriodEnd] = useState(period.end);
  const [branchFilter, setBranchFilter] = useState('all');
  const [branchOptions, setBranchOptions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [running, setRunning] = useState(false);
  const [activeRun, setActiveRun] = useState(null);
  const [viewing, setViewing] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadBranches(); loadRuns(); }, []);

  const loadBranches = async () => {
    const res = await base44.functions.invoke('airtableEmployees', { action: 'allActive' });
    const set = new Set();
    (res.data?.records || []).forEach(r => {
      const b = String(r.fields?.Branch || r.fields?.BRANCH || '').trim();
      if (b) set.add(b);
    });
    setBranchOptions(Array.from(set).sort((a, b) => a.localeCompare(b)));
  };

  const loadRuns = async () => {
    const res = await base44.functions.invoke('reconcilePeriod', { action: 'list_runs' });
    setRuns(res.data?.runs || []);
  };

  // Poll the active run for progress while it processes.
  useEffect(() => {
    if (!running || !activeRun?.id) return;
    const interval = setInterval(async () => {
      const res = await base44.functions.invoke('reconcilePeriod', { action: 'list_runs' }).catch(() => null);
      const fresh = res?.data?.runs?.find(r => r.id === activeRun.id);
      if (fresh) setActiveRun(fresh);
    }, 2000);
    return () => clearInterval(interval);
  }, [running, activeRun?.id]);

  const handleRun = async () => {
    setRunning(true);
    setActiveRun({ processed: 0, total: 0, progress: 0 });
    const res = await base44.functions.invoke('reconcilePeriod', {
      period_start: periodStart,
      period_end: periodEnd,
      period_label: `${periodStart} – ${periodEnd}`,
      branch_filter: branchFilter,
    });
    setRunning(false);
    setActiveRun(null);
    if (res.data?.success) {
      toast({ title: 'Reconciliation complete', description: `${res.data.count} employees computed and saved.` });
    } else {
      toast({ title: 'Reconciliation failed', description: res.data?.error || 'Unknown error', variant: 'destructive' });
    }
    loadRuns();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-semibold text-lg">Payroll Reconciliation</h1>
            <p className="text-xs text-muted-foreground">Compute and save final attendance pay per period, with full run history.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadRuns}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      <RunReconcileCard
        periodStart={periodStart}
        periodEnd={periodEnd}
        branchFilter={branchFilter}
        branchOptions={branchOptions}
        onPeriodChange={(s, e) => { setPeriodStart(s); setPeriodEnd(e); }}
        onBranchChange={setBranchFilter}
        onRun={handleRun}
        running={running}
        activeRun={activeRun}
      />

      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-semibold mb-3">Reconciliation history</h2>
        <ReconcileHistoryTable runs={runs} onView={setViewing} />
      </div>

      {viewing && <ReconcileResultModal run={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
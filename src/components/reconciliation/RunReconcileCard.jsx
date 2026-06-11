import { useState } from 'react';
import { CheckCircle2, Loader2, Filter } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Card to configure & trigger a reconciliation run for a period + branch.
export default function RunReconcileCard({
  periodStart, periodEnd, branchFilter, branchOptions,
  onPeriodChange, onBranchChange, onRun, running, activeRun,
}) {
  const [confirming, setConfirming] = useState(false);

  const pct = activeRun?.total ? Math.round((activeRun.processed / activeRun.total) * 100) : (activeRun?.progress || 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Run reconciliation</h2>
        <p className="text-xs text-muted-foreground">
          Compute final attendance pay for the selected period. Results are saved and used by payroll.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Period Start</Label>
          <Input type="date" value={periodStart} onChange={e => onPeriodChange(e.target.value, periodEnd)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Period End</Label>
          <Input type="date" value={periodEnd} onChange={e => onPeriodChange(periodStart, e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Branch*</Label>
          <Select value={branchFilter} onValueChange={onBranchChange}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select a branch…" /></SelectTrigger>
            <SelectContent>
              {branchOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {running && activeRun && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Processing {activeRun.processed || 0}/{activeRun.total || '…'} employees</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Filter className="w-3 h-3" /> {branchFilter ? branchFilter : 'No branch selected'}
        </span>
        <div className="ml-auto">
          <Button onClick={onRun} disabled={running || !branchFilter}>
            {running ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
            {running ? 'Reconciling…' : 'Run & Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
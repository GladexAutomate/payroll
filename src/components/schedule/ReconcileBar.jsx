import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Controls on the Approved Schedule page: toggle the actual-attendance overlay
// and run the payroll reconciliation for the visible period.
export default function ReconcileBar({ showActual, onToggleActual, onReconcile, reconciling, lastReconciledAt }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
      <div className="text-xs text-blue-900">
        <p className="font-semibold">Payroll reconciliation</p>
        <p className="text-blue-700">
          Overlay actual punches on the plotted schedule, review, then approve for payroll.
          {lastReconciledAt && <span className="ml-1">Last run: {lastReconciledAt}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToggleActual}>
          {showActual ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
          {showActual ? 'Hide actual' : 'Show actual'}
        </Button>
        <Button size="sm" onClick={onReconcile} disabled={reconciling}>
          {reconciling ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
          {reconciling ? 'Approving…' : 'Approve for Payroll'}
        </Button>
      </div>
    </div>
  );
}
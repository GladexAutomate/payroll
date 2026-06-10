import { Eye, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { peso, fmtDateTime, fmtDuration, RUN_STATUS } from './reconcileFormat';

// History of past reconciliation runs.
export default function ReconcileHistoryTable({ runs, onView }) {
  if (!runs.length) {
    return (
      <div className="text-sm text-muted-foreground py-10 text-center">
        No reconciliation runs yet. Run one above to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="py-2 px-3 font-medium">Run date</th>
            <th className="py-2 px-3 font-medium">Period</th>
            <th className="py-2 px-3 font-medium">Branch</th>
            <th className="py-2 px-3 font-medium">Status</th>
            <th className="py-2 px-3 font-medium text-right">Employees</th>
            <th className="py-2 px-3 font-medium text-right">Total Gross</th>
            <th className="py-2 px-3 font-medium">Duration</th>
            <th className="py-2 px-3 font-medium">By</th>
            <th className="py-2 px-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => {
            const status = RUN_STATUS[run.status] || RUN_STATUS.processing;
            return (
              <tr key={run.id} className="border-b border-border/60 hover:bg-accent/40">
                <td className="py-2.5 px-3 whitespace-nowrap">{fmtDateTime(run.started_at || run.created_date)}</td>
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{run.period_label || `${run.period_start} – ${run.period_end}`}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">{run.branch_filter || 'all'}</td>
                <td className="py-2.5 px-3">
                  <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${status.className}`}>
                    {run.status === 'processing' && run.total
                      ? `${Math.round((run.processed / run.total) * 100)}%`
                      : status.label}
                  </span>
                  {run.status === 'failed' && run.error_message && (
                    <span className="ml-1 inline-flex items-center text-red-600" title={run.error_message}>
                      <AlertCircle className="w-3.5 h-3.5" />
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right">{run.employee_count || run.processed || 0}</td>
                <td className="py-2.5 px-3 text-right font-medium">{peso(run.total_gross)}</td>
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{fmtDuration(run.duration_ms)}</td>
                <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{run.run_by || '—'}</td>
                <td className="py-2.5 px-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onView(run)} disabled={run.status !== 'completed'}>
                    <Eye className="w-4 h-4 mr-1" /> View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Play, CheckCircle, Eye, Trash2, RefreshCw, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PayrollRunDetail from '@/components/payroll/PayrollRunDetail';
import PayrollProgress from '@/components/payroll/PayrollProgress';
import RejectPayrollDialog from '@/components/payroll/RejectPayrollDialog';
import SignDialog from '@/components/approval/SignDialog';
import { loadPayrollApprovalContext } from '@/lib/payrollApproval';
import { fmtDate } from '@/lib/dateFormat';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const formatPeso = (value) => (
  value == null ? '—' : `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
);

export default function Payroll() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [computing, setComputing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [rejectRun, setRejectRun] = useState(null);
  const [perms, setPerms] = useState({ canCreate: false, canApprove1: false, canApprove2: false, isAdmin: false, email: '', userId: '' });
  // { run, step } when an approval signature is being captured
  const [signTarget, setSignTarget] = useState(null);

  useEffect(() => { loadRuns(); loadPerms(); }, []);

  const loadPerms = async () => {
    const ctx = await loadPayrollApprovalContext();
    setPerms({ ...ctx, userId: ctx.user?.id || '' });
  };

  useEffect(() => {
    const hasComputingRun = runs.some(run => run.status === 'computing');
    if (!hasComputingRun) return;
    const timer = setInterval(() => loadRuns({ silent: true }), 2000);
    return () => clearInterval(timer);
  }, [runs]);

  const loadRuns = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const data = await base44.entities.PayrollRun.list('-period_start', 50);
    setRuns(data);
    if (!silent) setLoading(false);
  };

  const handleCompute = async (run) => {
    setComputing(run.id);
    setRuns(prev => prev.map(item => item.id === run.id ? {
      ...item,
      status: 'computing',
      compute_progress: 1,
      compute_processed: 0,
      compute_total: item.employee_count || 0
    } : item));

    base44.functions.invoke('computePayroll', { payroll_run_id: run.id })
      .then(() => loadRuns({ silent: true }))
      .catch(error => {
        setDialog({
          title: 'Payroll generation failed',
          description: error?.response?.data?.error || error?.message || 'Unable to build payroll. Please retry.',
        });
        loadRuns({ silent: true });
      })
      .finally(() => setComputing(null));
  };

  const handleRecompute = (run) => {
    setDialog({
      title: 'Rebuild payroll?',
      description: `Rebuild ${run.period_label} from its reconciled result? This regenerates payroll records from the (possibly edited) reconciliation.`,
      confirmLabel: 'Rebuild',
      onConfirm: () => { setDialog(null); handleCompute(run); },
    });
  };

  // Step 1 of 3: creator submits a computed run for approval.
  const handleSubmit = (run) => {
    setDialog({
      title: 'Submit for approval?',
      description: `Submit ${run.period_label} to Approver 1? You won't be able to delete it while it's under review.`,
      confirmLabel: 'Submit',
      onConfirm: async () => {
        setDialog(null);
        setRuns(prev => prev.map(item => item.id === run.id ? { ...item, status: 'pending_approval_1' } : item));
        await base44.entities.PayrollRun.update(run.id, {
          status: 'pending_approval_1',
          submitted_by: perms.email,
          submitted_date: new Date().toISOString(),
          rejection_reason: '', rejected_by: '', rejected_date: '',
        });
        loadRuns({ silent: true });
      },
    });
  };

  // Step 2 of 3: Approver 1 signs to approve -> moves to Approver 2.
  const handleApprove1 = (run) => setSignTarget({ run, step: 1 });

  // Step 3 of 3: Approver 2 signs for final approval -> archives via existing function.
  const handleApprove2 = (run) => setSignTarget({ run, step: 2 });

  // Persist the signature for whichever approval step is active.
  const applySignature = async (signatureUrl) => {
    const { run, step } = signTarget;
    setSignTarget(null);
    if (step === 1) {
      setRuns(prev => prev.map(item => item.id === run.id ? { ...item, status: 'pending_approval_2' } : item));
      await base44.entities.PayrollRun.update(run.id, {
        status: 'pending_approval_2',
        approval_1_by: perms.email,
        approval_1_date: new Date().toISOString(),
        approval_1_signature: signatureUrl,
      });
      loadRuns({ silent: true });
    } else {
      setRuns(prev => prev.map(item => item.id === run.id ? { ...item, status: 'approved' } : item));
      await base44.entities.PayrollRun.update(run.id, {
        approval_2_by: perms.email,
        approval_2_date: new Date().toISOString(),
        approval_2_signature: signatureUrl,
      });
      base44.functions.invoke('approvePayroll', { payroll_run_id: run.id })
        .catch(error => {
          setDialog({
            title: 'Approval failed',
            description: error?.response?.data?.error || error?.message || 'Unable to approve payroll. Please retry.',
          });
        })
        .finally(() => loadRuns({ silent: true }));
    }
  };

  const performReject = async (reason) => {
    const run = rejectRun;
    setRejectRun(null);
    setRuns(prev => prev.map(item => item.id === run.id ? { ...item, status: 'rejected' } : item));
    await base44.entities.PayrollRun.update(run.id, {
      status: 'rejected',
      rejected_by: perms.email,
      rejected_date: new Date().toISOString(),
      rejection_reason: reason,
    });
    loadRuns({ silent: true });
  };

  const handleDelete = (run) => {
    setDialog({
      title: 'Delete payroll run?',
      description: `Delete ${run.period_label}? This will also delete all payroll records inside this run.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => { setDialog(null); performDelete(run); },
    });
  };

  const performDelete = (run) => {
    setDeleting(run.id);
    setRuns(prev => prev.filter(item => item.id !== run.id));
    setSelectedRun(prev => prev?.id === run.id ? null : prev);
    const releaseDeleteState = setTimeout(() => setDeleting(current => current === run.id ? null : current), 3000);
    base44.functions.invoke('deletePayrollRun', { payroll_run_id: run.id })
      .catch(() => {
        setDialog({
          title: 'Cleanup in progress',
          description: 'The payroll row was removed from the screen. Backend cleanup is still running or needs a later retry.',
        });
      })
      .finally(() => {
        clearTimeout(releaseDeleteState);
        setDeleting(null);
        loadRuns({ silent: true });
      });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{runs.length} payroll runs</p>
        {perms.canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Payroll Run
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Period</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Pay Date</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employees</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Gross Pay</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Total Deductions</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Net Pay</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(8)].map((_, j) => <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : runs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No payroll runs yet. Create one to get started.</td></tr>
              ) : runs.map(run => {
                const missingComputedTotals = run.status === 'processing' && run.total_gross == null && run.total_net == null;
                return (
                <tr key={run.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-medium">{run.period_label}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(run.period_start)} → {fmtDate(run.period_end)}</p>
                    {run.branch_name && <p className="text-xs text-primary mt-0.5">{run.branch_name}</p>}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground">{fmtDate(run.pay_date)}</td>
                  <td className="py-3.5 px-4 text-right">{run.employee_count || '—'}</td>
                  <td className="py-3.5 px-4 text-right font-medium">
                    {formatPeso(run.total_gross)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-red-600">
                    {formatPeso(run.total_deductions)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-green-600">
                    {formatPeso(run.total_net)}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={run.status} label={run.status === 'processing' ? 'Computed' : undefined} />
                    <PayrollProgress run={run} />
                    {run.status === 'rejected' && run.rejection_reason && (
                      <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-red-700">Rejected: {run.rejection_reason}</p>
                    )}
                    {run.status === 'pending_approval_2' && run.approval_1_by && (
                      <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-muted-foreground">Step 1 approved by {run.approval_1_by}</p>
                    )}
                    {(run.approval_1_signature || run.approval_2_signature) && (
                      <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                        {run.approval_1_signature && (
                          <div className="flex flex-col items-center gap-0.5">
                            <img src={run.approval_1_signature} alt="Approver 1" className="h-7 w-auto object-contain border border-border rounded bg-white px-1" />
                            <span className="text-[10px] text-muted-foreground">Approver 1</span>
                          </div>
                        )}
                        {run.approval_2_signature && (
                          <div className="flex flex-col items-center gap-0.5">
                            <img src={run.approval_2_signature} alt="Approver 2" className="h-7 w-auto object-contain border border-border rounded bg-white px-1" />
                            <span className="text-[10px] text-muted-foreground">Approver 2</span>
                          </div>
                        )}
                      </div>
                    )}
                    {missingComputedTotals && <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-amber-700">No totals were saved. Click recompute.</p>}
                    {run.notes && <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-amber-700">{run.notes}</p>}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedRun(run)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {(run.status === 'draft' || run.status === 'computing') && (
                        <button
                          onClick={() => handleCompute(run)}
                          disabled={computing === run.id || run.status === 'computing'}
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
                          title="Build payroll from reconciled result"
                        >
                          <Play className={`w-3.5 h-3.5 ${computing === run.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      {(run.status === 'processing' || run.status === 'rejected') && (
                        <button
                          onClick={() => handleRecompute(run)}
                          disabled={computing === run.id}
                          className="p-1.5 rounded hover:bg-amber-50 text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-50"
                          title="Rebuild from reconciled result"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${computing === run.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      {/* Step 1: creator submits a computed run for approval */}
                      {run.status === 'processing' && perms.canCreate && (
                        <button
                          onClick={() => handleSubmit(run)}
                          className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"
                          title="Submit for approval"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Step 2: Approver 1 (cannot be the submitter) */}
                      {run.status === 'pending_approval_1' && perms.canApprove1 && normalizeEmail(run.submitted_by) !== perms.email && (
                        <button
                          onClick={() => handleApprove1(run)}
                          className="p-1.5 rounded hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
                          title="Approve (Step 1)"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Step 3: Approver 2 final approval (cannot be the submitter) */}
                      {run.status === 'pending_approval_2' && perms.canApprove2 && normalizeEmail(run.submitted_by) !== perms.email && (
                        <button
                          onClick={() => handleApprove2(run)}
                          className="p-1.5 rounded hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
                          title="Final approval (Step 2)"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Reject: available to the relevant approver at either pending stage */}
                      {((run.status === 'pending_approval_1' && perms.canApprove1) || (run.status === 'pending_approval_2' && perms.canApprove2)) && normalizeEmail(run.submitted_by) !== perms.email && (
                        <button
                          onClick={() => setRejectRun(run)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
                          title="Reject back to creator"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {run.status !== 'approved' && run.status !== 'released' && run.status !== 'pending_approval_1' && run.status !== 'pending_approval_2' && (
                        <button
                          onClick={() => handleDelete(run)}
                          disabled={deleting === run.id}
                          className="p-1.5 rounded hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                          title="Delete payroll run"
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${deleting === run.id ? 'animate-pulse' : ''}`} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreatePayrollModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadRuns(); }}
        />
      )}

      {selectedRun && (
        <PayrollRunDetail
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}

      <ConfirmDialog
        open={!!dialog}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title={dialog?.title}
        description={dialog?.description}
        confirmLabel={dialog?.confirmLabel}
        destructive={dialog?.destructive}
        onConfirm={dialog?.onConfirm}
      />

      <RejectPayrollDialog
        open={!!rejectRun}
        run={rejectRun}
        onOpenChange={(open) => { if (!open) setRejectRun(null); }}
        onConfirm={performReject}
      />

      {signTarget && (
        <SignDialog
          userId={perms.userId}
          onClose={() => setSignTarget(null)}
          onSign={applySignature}
        />
      )}
    </div>
  );
}

function CreatePayrollModal({ onClose, onCreated }) {
  const [reconciledRuns, setReconciledRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [payDate, setPayDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pull completed reconciliation runs — the payroll basis is chosen from this history.
  useEffect(() => {
    setLoadingRuns(true);
    base44.functions.invoke('reconcilePeriod', { action: 'list_runs' })
      .then(res => {
        const runs = (res.data?.runs || []).filter(r => r.status === 'completed');
        setReconciledRuns(runs);
      })
      .finally(() => setLoadingRuns(false));
  }, []);

  const selected = reconciledRuns.find(r => r.id === selectedRunId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const branchName = selected.branch_filter && selected.branch_filter !== 'all' ? selected.branch_filter : '';
    await base44.entities.PayrollRun.create({
      period_label: selected.period_label || `${selected.period_start} – ${selected.period_end}`,
      period_start: selected.period_start,
      period_end: selected.period_end,
      pay_date: payDate,
      branch_id: branchName,
      branch_name: branchName,
      status: 'draft',
    });
    onCreated();
  };

  const fmtPeso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">New Payroll Run</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Choose a reconciled result as the payroll basis.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Reconciled result*</label>
            {loadingRuns ? (
              <div className="mt-2 h-9 bg-muted rounded animate-pulse" />
            ) : reconciledRuns.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No completed reconciliations yet. Run a reconciliation first, then come back here.</p>
            ) : (
              <select
                value={selectedRunId}
                onChange={e => setSelectedRunId(e.target.value)}
                required
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Choose a reconciled period...</option>
                {reconciledRuns.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.period_label} · {r.branch_filter || 'all'} · {r.employee_count || 0} emp
                  </option>
                ))}
              </select>
            )}
          </div>

          {selected && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p className="font-medium">{selected.period_label}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(selected.period_start)} → {fmtDate(selected.period_end)} · {selected.branch_filter || 'all'} branch</p>
              <div className="flex justify-between text-xs pt-1">
                <span className="text-muted-foreground">{selected.employee_count || 0} employees</span>
                <span className="font-medium">{fmtPeso(selected.total_gross)} gross</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Pay Date</label>
            <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!selected || submitting}>Create Run</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
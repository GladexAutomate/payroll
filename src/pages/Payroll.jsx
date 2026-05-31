import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Play, CheckCircle, Eye, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PayrollRunDetail from '@/components/payroll/PayrollRunDetail';
import PayrollProgress from '@/components/payroll/PayrollProgress';
import { format } from 'date-fns';

export default function Payroll() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [computing, setComputing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [dialog, setDialog] = useState(null);

  useEffect(() => { loadRuns(); }, []);

  useEffect(() => {
    const hasComputingRun = runs.some(run => run.status === 'computing');
    if (!hasComputingRun) return;
    const timer = setInterval(loadRuns, 2000);
    return () => clearInterval(timer);
  }, [runs]);

  const loadRuns = async () => {
    setLoading(true);
    const data = await base44.entities.PayrollRun.list('-period_start', 50);
    setRuns(data);
    setLoading(false);
  };

  const handleCompute = async (run, reconcile = false) => {
    setComputing(run.id);
    setRuns(prev => prev.map(item => item.id === run.id ? {
      ...item,
      status: 'computing',
      compute_progress: 1,
      compute_processed: 0,
      compute_total: item.employee_count || 0
    } : item));

    base44.functions.invoke('computePayroll', { payroll_run_id: run.id, reconcile })
      .then(loadRuns)
      .finally(() => setComputing(null));
  };

  const handleRecompute = (run) => {
    setDialog({
      title: 'Recompute payroll?',
      description: `Recompute ${run.period_label}? This regenerates payroll records from the saved attendance summaries.`,
      confirmLabel: 'Recompute',
      onConfirm: () => { setDialog(null); handleCompute(run, false); },
    });
  };

  const handleApprove = async (run) => {
    await base44.entities.PayrollRun.update(run.id, {
      status: 'approved',
      approved_date: new Date().toISOString()
    });
    loadRuns();
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

  const performDelete = async (run) => {
    setDeleting(run.id);
    setRuns(prev => prev.filter(item => item.id !== run.id));
    try {
      await base44.functions.invoke('deletePayrollRun', { payroll_run_id: run.id });
    } catch (error) {
      setDialog({
        title: 'Cleanup in progress',
        description: 'Delete is still running slowly in the backend. The row will stay hidden while cleanup continues.',
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{runs.length} payroll runs</p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> New Payroll Run
        </Button>
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
              ) : runs.map(run => (
                <tr key={run.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-medium">{run.period_label}</p>
                    <p className="text-xs text-muted-foreground">{run.period_start} → {run.period_end}</p>
                    {run.branch_name && <p className="text-xs text-primary mt-0.5">{run.branch_name}</p>}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground">{run.pay_date || '—'}</td>
                  <td className="py-3.5 px-4 text-right">{run.employee_count || '—'}</td>
                  <td className="py-3.5 px-4 text-right font-medium">
                    {run.total_gross ? `₱${run.total_gross.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right text-red-600">
                    {run.total_deductions ? `₱${run.total_deductions.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-green-600">
                    {run.total_net ? `₱${run.total_net.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={run.status} />
                    <PayrollProgress run={run} />
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
                          title="Compute payroll"
                        >
                          <Play className={`w-3.5 h-3.5 ${computing === run.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      {(run.status === 'processing' || run.status === 'approved' || run.status === 'released') && (
                        <button
                          onClick={() => handleRecompute(run)}
                          disabled={computing === run.id}
                          className="p-1.5 rounded hover:bg-amber-50 text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-50"
                          title="Recompute payroll"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${computing === run.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      {run.status === 'processing' && (
                        <button
                          onClick={() => handleApprove(run)}
                          className="p-1.5 rounded hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
                          title="Approve payroll"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(run)}
                        disabled={!!deleting}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="Delete payroll run"
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${deleting === run.id ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}

function CreatePayrollModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    period_label: '',
    period_start: '',
    period_end: '',
    pay_date: '',
    branch_id: '',
    branch_name: ''
  });
  const [branches, setBranches] = useState([]);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000).then(data => {
      const branchNames = [...new Set(data
        .map(employee => employee.branch || employee.fields?.Branch)
        .filter(Boolean)
        .map(branch => String(branch).trim())
      )].sort((a, b) => a.localeCompare(b));
      setBranches(branchNames.map(name => ({ id: name, name })));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.PayrollRun.create({ ...form, status: 'draft' });
    onCreated();
  };

  const handleBranchChange = (branchId) => {
    const branch = branches.find(item => item.id === branchId);
    setForm(prev => ({
      ...prev,
      branch_id: branch?.id || '',
      branch_name: branch?.name || ''
    }));
  };

  // Auto-fill period label. Parse YYYY-MM-DD as a local date (append T00:00:00) so the
  // day is never shifted by timezone conversion.
  const autoLabel = () => {
    if (form.period_start && form.period_end) {
      const s = format(new Date(`${form.period_start}T00:00:00`), 'MMM d');
      const e = format(new Date(`${form.period_end}T00:00:00`), 'MMM d, yyyy');
      set('period_label', `${s} – ${e}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Create Payroll Run</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Branch*</label>
            <select
              value={form.branch_id}
              onChange={e => handleBranchChange(e.target.value)}
              required
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Choose branch first...</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            {!form.branch_id && <p className="mt-1 text-[11px] text-muted-foreground">Select a branch before completing payroll details.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Period Start*</label>
              <Input type="date" value={form.period_start} onChange={e => { set('period_start', e.target.value); }} onBlur={autoLabel} required disabled={!form.branch_id} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Period End*</label>
              <Input type="date" value={form.period_end} onChange={e => set('period_end', e.target.value)} onBlur={autoLabel} required disabled={!form.branch_id} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Period Label*</label>
            <Input value={form.period_label} onChange={e => set('period_label', e.target.value)} required disabled={!form.branch_id} className="mt-1" placeholder="e.g. May 1–15, 2026" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Pay Date</label>
            <Input type="date" value={form.pay_date} onChange={e => set('pay_date', e.target.value)} disabled={!form.branch_id} className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!form.branch_id}>Create Run</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
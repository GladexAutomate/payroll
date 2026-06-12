import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Gift, Calculator, Loader2, Info, Download } from 'lucide-react';
import ReportFilters from '@/components/compliance/ReportFilters';
import ThirteenthMonthTable from '@/components/payroll/ThirteenthMonthTable';
import ThirteenthMonthDetailModal from '@/components/payroll/ThirteenthMonthDetailModal';
import SavedThirteenthMonthTable from '@/components/payroll/SavedThirteenthMonthTable';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { exportToCsv } from '@/lib/exportCsv';
import { useToast } from '@/components/ui/use-toast';

export default function ThirteenthMonth() {
  const { toast } = useToast();
  const [tab, setTab] = useState('compute'); // 'compute' | 'saved'
  const [filters, setFilters] = useState({ year: new Date().getFullYear(), month: null, branch: null });
  const [basis, setBasis] = useState('accrued'); // 'accrued' | 'prorated'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailFor, setDetailFor] = useState(null);

  const [saved, setSaved] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState(null);

  const loadSaved = async () => {
    setLoadingSaved(true);
    const recs = await base44.entities.ThirteenthMonthRecord.list('-approved_date', 5000);
    setSaved(recs || []);
    setLoadingSaved(false);
  };

  useEffect(() => { loadSaved(); }, []);

  const run = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('thirteenthMonthReport', { year: filters.year, branch: filters.branch });
    setData(res.data);
    setLoading(false);
  };

  const handleExport = () => {
    if (!data?.employees?.length) return;
    const num = (n) => Number(n || 0).toFixed(2);
    const columns = [
      { key: 'employee_code', label: 'Employee Code' },
      { key: 'employee_name', label: 'Employee Name' },
      { key: 'basic_salary', label: 'Monthly Basic', format: num },
      { key: 'months_worked', label: 'Months Active' },
      { key: 'basic_earned', label: 'Basic Salary Earned', format: num },
      { key: 'accrued', label: 'Accrued 13th Month', format: num },
      { key: 'prorated', label: 'Prorated 13th Month', format: num },
    ];
    exportToCsv(`13th_month_${filters.year}${filters.branch ? '_' + String(filters.branch).replace(/[^\w-]+/g, '_') : ''}`, columns, data.employees);
  };

  // Persist the (possibly edited) computation to the 13th Month Pay table.
  const handleSave = async (payload) => {
    const user = await base44.auth.me();
    const branch = filters.branch || 'all';
    // Replace any existing saved record for this employee+year so re-saving updates it.
    const existing = saved.filter(r => r.employee_id === payload.employee_id && r.year === payload.year);
    for (const r of existing) await base44.entities.ThirteenthMonthRecord.delete(r.id);
    await base44.entities.ThirteenthMonthRecord.create({
      ...payload,
      branch,
      approved_by: user?.email || '',
      approved_date: new Date().toISOString(),
    });
    toast({ title: 'Saved', description: `${payload.employee_name}'s 13th month pay saved to the table.` });
    setDetailFor(null);
    loadSaved();
  };

  const performDelete = async () => {
    const r = deleteRecord;
    setDeleteRecord(null);
    setSaved(prev => prev.filter(x => x.id !== r.id));
    await base44.entities.ThirteenthMonthRecord.delete(r.id);
    loadSaved();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">13th Month Pay</h1>
          <p className="text-sm text-muted-foreground">Computed per P.D. 851 — total basic salary earned in the year ÷ 12</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {[{ id: 'compute', label: 'Compute' }, { id: 'saved', label: `Saved Records${saved.length ? ` (${saved.length})` : ''}` }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'compute' ? (
        <>
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <p>
              <span className="font-medium text-foreground">Accrued</span> shows what each employee has earned so far this year ÷ 12.{' '}
              <span className="font-medium text-foreground">Prorated</span> projects the full-year amount based on the monthly basic salary and months active (for mid-year hires or resignations). Unpaid absences are excluded because no basic salary is earned for those days.{' '}
              For the current year, months that aren't reconciled yet (e.g. December) are <span className="font-medium text-foreground">precomputed from the plotted schedule</span> and marked with a <span className="font-medium text-amber-700">proj.</span> tag.{' '}
              Click a record to review the full month-by-month computation and approve it.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <ReportFilters {...filters} onChange={setFilters} />
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Computation</label>
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="accrued">Accrued so far</option>
                <option value="prorated">Prorated full-year</option>
              </select>
            </div>
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Calculator className="w-4 h-4 mr-1.5" />}
              Compute
            </Button>
            {data && data.employees?.length > 0 && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-1.5" /> Export
              </Button>
            )}
          </div>

          {data && data.employees && (
            <ThirteenthMonthTable
              employees={data.employees}
              totals={data.totals}
              basis={basis}
              onViewPayslip={setDetailFor}
            />
          )}
        </>
      ) : (
        <SavedThirteenthMonthTable
          records={saved}
          loading={loadingSaved}
          onDelete={setDeleteRecord}
          onView={(r) => setDetailFor({ ...r, monthly: r.monthly || [] })}
        />
      )}

      {detailFor && (
        <ThirteenthMonthDetailModal
          record={detailFor}
          year={detailFor.year || filters.year}
          basis={detailFor.basis || basis}
          onClose={() => setDetailFor(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={!!deleteRecord}
        onOpenChange={(open) => { if (!open) setDeleteRecord(null); }}
        title="Delete saved record?"
        description={deleteRecord ? `Remove ${deleteRecord.employee_name}'s saved 13th month pay for ${deleteRecord.year}?` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={performDelete}
      />
    </div>
  );
}
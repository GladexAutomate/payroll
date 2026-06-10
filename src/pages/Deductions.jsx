import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAirtableEmployeeName, isActiveAirtableEmployee } from '@/utils/airtableEmployee';
import DeductionForm from '@/components/deductions/DeductionForm';
import GovernmentSettings from '@/components/deductions/GovernmentSettings';
import { useCurrentTier } from '@/hooks/useCurrentTier';
import { useEmployeeScope } from '@/lib/useEmployeeScope';
import { buildRequestorTierMap } from '@/lib/requestorTier';
import ApprovalChain from '@/components/approval/ApprovalChain';

const peso = (v) => `₱${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ATD_BADGE = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-50 text-red-600',
};

export default function Deductions() {
  const current = useCurrentTier();
  const { ownIds } = useEmployeeScope();
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branchesByCompany, setBranchesByCompany] = useState({});
  const [tierMap, setTierMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('deduction');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [list, emps, hierarchy] = await Promise.all([
      base44.entities.EmployeeDeduction.list('-created_date', 500),
      base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000),
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
    ]);
    const comps = hierarchy.data?.companies || [];
    const branches = hierarchy.data?.branches || [];
    setItems(list);
    const activeEmps = emps.filter(isActiveAirtableEmployee).sort((a, b) => getAirtableEmployeeName(a).localeCompare(getAirtableEmployeeName(b)));
    setEmployees(activeEmps);
    setTierMap(await buildRequestorTierMap(emps));
    setCompanies([...new Set(comps.map(c => c.name).filter(Boolean))].sort());
    // Group branches (from the org hierarchy) by their company name.
    const byCompany = {};
    branches.forEach(b => {
      if (!b.company_name || !b.name) return;
      byCompany[b.company_name] = byCompany[b.company_name] || new Set();
      byCompany[b.company_name].add(b.name);
    });
    setBranchesByCompany(Object.fromEntries(Object.entries(byCompany).map(([k, v]) => [k, [...v].sort()])));
    setLoading(false);
  };

  const empMap = employees.reduce((m, e) => ({ ...m, [e.id]: e }), {});
  const filtered = items.filter(i => i.kind === tab);

  const handleDelete = async (id) => {
    await base44.entities.EmployeeDeduction.delete(id);
    loadData();
  };

  // Chain update; once fully signed, auto-activate the ATD/allowance.
  const handleChainUpdate = async (item, patch) => {
    const update = { approval_chain: patch.approval_chain ?? item.approval_chain, chain_status: patch.chain_status };
    if (patch.fully_signed) { update.atd_status = 'active'; update.atd_approved_date = new Date().toISOString(); }
    if (patch.rejected) update.atd_status = 'cancelled';
    await base44.entities.EmployeeDeduction.update(item.id, update);
    loadData();
  };

  const cancelATD = async (item) => {
    await base44.entities.EmployeeDeduction.update(item.id, { atd_status: 'cancelled', chain_status: 'rejected' });
    loadData();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[['deduction', 'Charges / ATD'], ['allowance', 'Allowances'], ['government', 'Gov. Deductions']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${tab === k ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        {tab !== 'government' && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New {tab === 'allowance' ? 'Allowance' : 'Charge'}
          </Button>
        )}
      </div>

      {tab === 'government' ? (
        <GovernmentSettings employees={employees} />
      ) : (
        <>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Company</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Branch</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Label</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Per Cutoff</th>
                {tab === 'deduction' && <>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Progress</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Start</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">ATD</th>
                </>}
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Approval Chain</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => <tr key={i} className="border-b border-border/50">{[...Array(tab === 'deduction' ? 10 : 6)].map((_, j) => <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No {tab === 'allowance' ? 'allowances' : 'charges'} yet.</td></tr>
              ) : filtered.map(item => {
                const emp = empMap[item.employee_id];
                return (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium">{emp ? getAirtableEmployeeName(emp) : item.employee_name || item.employee_id}</td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">{item.company || '—'}</td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">{item.branch || 'All branches'}</td>
                    <td className="py-3.5 px-4">{item.label}</td>
                    <td className="py-3.5 px-4 text-right">{peso(item.amount_per_cutoff)}</td>
                    {tab === 'deduction' && <>
                      <td className="py-3.5 px-4 text-right">{item.recurring ? '—' : peso(item.total_amount)}</td>
                      <td className="py-3.5 px-4 text-center text-xs text-muted-foreground">{item.recurring ? 'Recurring' : `${item.cutoffs_paid || 0}/${item.total_cutoffs || '?'}`}</td>
                      <td className="py-3.5 px-4 text-xs">{item.start_date || '—'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ATD_BADGE[item.atd_status] || ATD_BADGE.draft}`}>{item.atd_status || 'draft'}</span>
                      </td>
                    </>}
                    <td className="py-3.5 px-4 min-w-[260px]">
                      {!current.loading && (
                        <ApprovalChain
                          record={item}
                          requestorTier={tierMap[item.employee_id] || 'employees'}
                          current={current}
                          isOwnRecord={ownIds?.has(String(item.employee_id))}
                          onUpdate={(patch) => handleChainUpdate(item, patch)}
                        />
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {['active', 'approved'].includes(item.atd_status) && (
                          <button onClick={() => cancelATD(item)} title="Cancel" className="p-1.5 rounded hover:bg-red-50 text-red-600"><X className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <DeductionForm kind={tab} employees={employees} companies={companies} branchesByCompany={branchesByCompany} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadData(); }} />
      )}
      </>
      )}
    </div>
  );
}
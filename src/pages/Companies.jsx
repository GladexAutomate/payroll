import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import MultiSelectList from '@/components/organization/MultiSelectList';
import SetupCard from '@/components/organization/SetupCard';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [res, branchRes, companyData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.functions.invoke('airtableEmployees', { action: 'branches' }),
      base44.entities.Company.list('name'),
    ]);
    setCompanies(res.data?.companies?.length ? res.data.companies : companyData);
    setBranches(res.data?.branches?.length ? res.data.branches : branchRes.data?.branches || []);
    setLoading(false);
  };

  const openMapping = (company) => {
    setSelectedCompany(company);
    setSelectedBranches(branches.filter(branch => branch.company_id === company.id).map(branch => branch.id));
  };

  const saveMapping = async () => {
    setSaving(true);
    for (const branch of branches) {
      if (selectedBranches.includes(branch.id) && branch.company_id !== selectedCompany.id) {
        await base44.functions.invoke('airtableEmployees', {
          action: 'updateCompanyForBranch',
          branchName: branch.name,
          companyName: selectedCompany.name,
        });
      }
    }
    setSaving(false);
    setSelectedCompany(null);
    loadData();
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Companies</h2>
        <p className="text-sm text-muted-foreground mt-1">Companies and branches are synced from Airtable. Mapping a branch updates the Company field for matching Airtable employees.</p>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Loading companies from Airtable...
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(company => (
            <SetupCard
              key={company.id}
              title={company.name}
              subtitle={`${company.employee_count || 0} Airtable employees`}
              count={branches.filter(branch => branch.company_id === company.id).length}
              onManage={() => openMapping(company)}
            />
          ))}
        </div>
      )}

      {selectedCompany && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Map Branches to {selectedCompany.name}</h3>
              <p className="text-sm text-muted-foreground">Selected branches will automatically update Airtable’s Company column.</p>
            </div>
            <MultiSelectList items={branches} selectedIds={selectedBranches} onToggle={(id) => setSelectedBranches(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedCompany(null)} disabled={saving}>Cancel</Button>
              <Button onClick={saveMapping} disabled={saving}>{saving ? 'Saving...' : 'Save Mapping'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
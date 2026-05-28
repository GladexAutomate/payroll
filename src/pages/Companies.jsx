import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiSelectList from '@/components/organization/MultiSelectList';
import SetupCard from '@/components/organization/SetupCard';
import EmployeeListModal from '@/components/organization/EmployeeListModal';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [employeeModal, setEmployeeModal] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [res, branchRes, companyData, employeeData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.functions.invoke('airtableEmployees', { action: 'branches' }),
      base44.entities.Company.list('name'),
      base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000),
    ]);
    const mergedCompanies = new Map();
    for (const company of (companyData || [])) mergedCompanies.set(company.name.toLowerCase(), company);
    for (const company of (res.data?.companies || [])) mergedCompanies.set(company.name.toLowerCase(), company);
    setCompanies(Array.from(mergedCompanies.values()).sort((a, b) => a.name.localeCompare(b.name)));
    setBranches(res.data?.branches?.length ? res.data.branches : branchRes.data?.branches || []);
    setEmployees(employeeData || []);
    setLoading(false);
  };

  const openMapping = (company) => {
    setSelectedCompany(company);
    setSelectedBranches(branches.filter(branch => branch.company_id === company.id).map(branch => branch.id));
  };

  const createCompany = async (e) => {
    e.preventDefault();
    const name = newCompanyName.trim();
    if (!name) return;
    setCreating(true);
    await base44.entities.Company.create({ name, status: 'active' });
    setNewCompanyName('');
    setShowCreateCompany(false);
    setCreating(false);
    await loadData();
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
      <div className="bg-card border border-border rounded-xl p-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg">Companies</h2>
          <p className="text-sm text-muted-foreground mt-1">Create companies manually, then map saved backend branches to them.</p>
        </div>
        <Button onClick={() => setShowCreateCompany(true)}>Create Company Manually</Button>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Loading companies from backend records...
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(company => (
            <SetupCard
              key={company.id}
              title={company.name}
              subtitle={
                <EmployeeListModal
                  employees={employees.filter(employee => employee.company === company.name)}
                  title={`${company.name} Employees`}
                  open={employeeModal === company.id}
                  onOpen={() => setEmployeeModal(company.id)}
                  onClose={() => setEmployeeModal(null)}
                />
              }
              count={branches.filter(branch => branch.company_id === company.id).length}
              onManage={() => openMapping(company)}
            />
          ))}
        </div>
      )}

      {showCreateCompany && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Create Company Manually</h3>
              <p className="text-sm text-muted-foreground">Add a company that you can map Airtable branches to.</p>
            </div>
            <form onSubmit={createCompany} className="space-y-4">
              <Input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Company name"
                disabled={creating}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setShowCreateCompany(false); setNewCompanyName(''); }} disabled={creating}>Cancel</Button>
                <Button type="submit" disabled={creating || !newCompanyName.trim()}>{creating ? 'Creating...' : 'Create Company'}</Button>
              </div>
            </form>
          </div>
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
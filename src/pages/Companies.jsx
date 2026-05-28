import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiSelectList from '@/components/organization/MultiSelectList';
import SetupCard from '@/components/organization/SetupCard';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [name, setName] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedBranches, setSelectedBranches] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [companyData, branchData] = await Promise.all([
      base44.entities.Company.list('name'),
      base44.entities.Branch.list('name'),
    ]);
    setCompanies(companyData);
    setBranches(branchData);
  };

  const createCompany = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await base44.entities.Company.create({ name: name.trim(), status: 'active' });
    setName('');
    loadData();
  };

  const openMapping = (company) => {
    setSelectedCompany(company);
    setSelectedBranches(branches.filter(branch => branch.company_id === company.id).map(branch => branch.id));
  };

  const saveMapping = async () => {
    for (const branch of branches) {
      if (selectedBranches.includes(branch.id) && branch.company_id !== selectedCompany.id) {
        await base44.entities.Branch.update(branch.id, { company_id: selectedCompany.id });
      }
    }
    setSelectedCompany(null);
    loadData();
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Companies</h2>
        <p className="text-sm text-muted-foreground mt-1">Create companies and choose which existing branches are under each company.</p>
      </div>

      <form onSubmit={createCompany} className="bg-card border border-border rounded-xl p-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" />
        <Button type="submit">Create Company</Button>
      </form>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(company => (
          <SetupCard
            key={company.id}
            title={company.name}
            count={branches.filter(branch => branch.company_id === company.id).length}
            onManage={() => openMapping(company)}
          />
        ))}
      </div>

      {selectedCompany && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Map Branches to {selectedCompany.name}</h3>
              <p className="text-sm text-muted-foreground">Select existing branches under this company.</p>
            </div>
            <MultiSelectList items={branches} selectedIds={selectedBranches} onToggle={(id) => setSelectedBranches(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedCompany(null)}>Cancel</Button>
              <Button onClick={saveMapping}>Save Mapping</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiSelectList from '@/components/organization/MultiSelectList';
import SetupCard from '@/components/organization/SetupCard';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [name, setName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedDepartments, setSelectedDepartments] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [branchData, departmentData] = await Promise.all([
      base44.entities.Branch.list('name'),
      base44.entities.Department.list('name'),
    ]);
    setBranches(branchData);
    setDepartments(departmentData);
  };

  const createBranch = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await base44.entities.Branch.create({ name: name.trim(), status: 'active' });
    setName('');
    loadData();
  };

  const openMapping = (branch) => {
    setSelectedBranch(branch);
    setSelectedDepartments(departments.filter(department => department.branch_id === branch.id).map(department => department.id));
  };

  const saveMapping = async () => {
    for (const department of departments) {
      if (selectedDepartments.includes(department.id) && department.branch_id !== selectedBranch.id) {
        await base44.entities.Department.update(department.id, { branch_id: selectedBranch.id, company_id: selectedBranch.company_id || '' });
      }
    }
    setSelectedBranch(null);
    loadData();
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Branches</h2>
        <p className="text-sm text-muted-foreground mt-1">Create branches and choose which departments are under each branch.</p>
      </div>

      <form onSubmit={createBranch} className="bg-card border border-border rounded-xl p-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Branch name" />
        <Button type="submit">Create Branch</Button>
      </form>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map(branch => (
          <SetupCard
            key={branch.id}
            title={branch.name}
            count={departments.filter(department => department.branch_id === branch.id).length}
            onManage={() => openMapping(branch)}
          />
        ))}
      </div>

      {selectedBranch && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Map Departments to {selectedBranch.name}</h3>
              <p className="text-sm text-muted-foreground">Select existing departments under this branch.</p>
            </div>
            <MultiSelectList items={departments} selectedIds={selectedDepartments} onToggle={(id) => setSelectedDepartments(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedBranch(null)}>Cancel</Button>
              <Button onClick={saveMapping}>Save Mapping</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import MultiSelectList from '@/components/organization/MultiSelectList';
import SetupCard from '@/components/organization/SetupCard';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [hierarchyResponse, departmentData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.entities.Department.list('name'),
    ]);

    const mergedDepartments = new Map();
    for (const department of (hierarchyResponse.data?.departments || [])) {
      mergedDepartments.set(`${department.name}-${department.branch_id || ''}`.toLowerCase(), department);
    }
    for (const department of (departmentData || [])) {
      mergedDepartments.set(`${department.name}-${department.branch_id || ''}`.toLowerCase(), department);
    }

    setBranches(hierarchyResponse.data?.branches || []);
    setDepartments(Array.from(mergedDepartments.values()).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  };

  const openMapping = (branch) => {
    setSelectedBranch(branch);
    setSelectedDepartments(departments.filter(department => department.branch_id === branch.id).map(department => department.id));
  };

  const saveMapping = async () => {
    for (const department of departments) {
      const shouldBeMapped = selectedDepartments.includes(department.id);
      if (shouldBeMapped && department.branch_id !== selectedBranch.id) {
        await base44.entities.Department.update(department.id, { branch_id: selectedBranch.id });
      }
      if (!shouldBeMapped && department.branch_id === selectedBranch.id) {
        await base44.entities.Department.update(department.id, { branch_id: '' });
      }
    }
    setSelectedBranch(null);
    loadData();
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Branches</h2>
        <p className="text-sm text-muted-foreground mt-1">Branches load from the saved backend copy of Airtable records.</p>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Loading branches from backend records...
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(branch => (
            <SetupCard
              key={branch.id}
              title={branch.name}
              subtitle={`${branch.employee_count} Airtable employees`}
              count={departments.filter(department => department.branch_id === branch.id).length}
              onManage={() => openMapping(branch)}
            >
              <span className="inline-flex w-fit max-w-full items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary truncate">
                Company: {branch.company_name || 'Unassigned'}
              </span>
            </SetupCard>
          ))}
        </div>
      )}

      {selectedBranch && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Map Departments to {selectedBranch.name}</h3>
              <p className="text-sm text-muted-foreground">Select existing departments under this Airtable branch.</p>
            </div>
            <MultiSelectList items={departments.filter(department => !department.branch_id || department.branch_id === selectedBranch.id)} selectedIds={selectedDepartments} onToggle={(id) => setSelectedDepartments(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])} />
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
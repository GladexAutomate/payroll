import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import MultiSelectList from '@/components/organization/MultiSelectList';
import SetupCard from '@/components/organization/SetupCard';

export default function DepartmentRoles() {
  const [departmentRoles, setDepartmentRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedDepartmentRole, setSelectedDepartmentRole] = useState(null);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [hierarchyRes, teamData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.entities.Team.list('name'),
    ]);
    const hierarchy = hierarchyRes.data || {};
    setCompanies(hierarchy.companies || []);
    setBranches(hierarchy.branches || []);
    setDepartments(hierarchy.departments || []);
    setDepartmentRoles(hierarchy.departmentRoles || []);
    setTeams(teamData);
  };

  const openMapping = (departmentRole) => {
    setSelectedDepartmentRole(departmentRole);
    setSelectedTeams(teams.filter(team => team.sub_department_id === departmentRole.id).map(team => team.id));
  };

  const saveMapping = async () => {
    for (const team of teams) {
      if (selectedTeams.includes(team.id) && team.sub_department_id !== selectedDepartmentRole.id) {
        await base44.entities.Team.update(team.id, {
          sub_department_id: selectedDepartmentRole.id,
          department_name: selectedDepartmentRole.name,
        });
      }
    }
    setSelectedDepartmentRole(null);
    loadData();
  };

  const availableBranches = selectedCompanyId ? branches.filter(branch => branch.company_id === selectedCompanyId) : branches;
  const availableDepartments = departments.filter(department => {
    const companyMatch = !selectedCompanyId || department.company_id === selectedCompanyId;
    const branchMatch = !selectedBranchId || department.branch_id === selectedBranchId;
    return companyMatch && branchMatch;
  });
  const filteredDepartmentRoles = departmentRoles.filter(role => {
    const companyMatch = !selectedCompanyId || role.company_id === selectedCompanyId;
    const branchMatch = !selectedBranchId || role.branch_id === selectedBranchId;
    const departmentMatch = !selectedDepartmentId || role.department_id === selectedDepartmentId;
    return companyMatch && branchMatch && departmentMatch;
  });

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Department Roles</h2>
        <p className="text-sm text-muted-foreground mt-1">Department roles load from the saved backend copy of Airtable records.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Filter by Company</label>
          <select value={selectedCompanyId} onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedBranchId(''); setSelectedDepartmentId(''); }} className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All companies</option>
            {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Filter by Branch</label>
          <select value={selectedBranchId} onChange={(e) => { setSelectedBranchId(e.target.value); setSelectedDepartmentId(''); }} className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All branches</option>
            {availableBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Filter by Department</label>
          <select value={selectedDepartmentId} onChange={(e) => setSelectedDepartmentId(e.target.value)} className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All departments</option>
            {availableDepartments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDepartmentRoles.map(departmentRole => (
          <SetupCard
            key={departmentRole.id}
            title={departmentRole.name}
            subtitle={`${departmentRole.employee_count || 0} employees in Airtable`}
            count={teams.filter(team => team.sub_department_id === departmentRole.id).length}
            onManage={() => openMapping(departmentRole)}
          >
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit max-w-full items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary truncate">
                Company: {departmentRole.company_name || 'Unassigned'}
              </span>
              <span className="inline-flex w-fit max-w-full items-center rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 truncate">
                Branch: {departmentRole.branch_name || 'Unassigned'}
              </span>
              <span className="inline-flex w-fit max-w-full items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 truncate">
                Department: {departmentRole.department_name || 'Unassigned'}
              </span>
            </div>
          </SetupCard>
        ))}
      </div>

      {selectedDepartmentRole && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Map Teams to {selectedDepartmentRole.name}</h3>
              <p className="text-sm text-muted-foreground">Select existing teams under this department role.</p>
            </div>
            <MultiSelectList items={teams} selectedIds={selectedTeams} onToggle={(id) => setSelectedTeams(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedDepartmentRole(null)}>Cancel</Button>
              <Button onClick={saveMapping}>Save Mapping</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SetupCard from '@/components/organization/SetupCard';
import EmployeeListModal from '@/components/organization/EmployeeListModal';
import { isNotResigned } from '@/utils/employeeStatus';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentRoles, setDepartmentRoles] = useState([]);
  const [name, setName] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [editName, setEditName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [employeeModal, setEmployeeModal] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [hierarchyRes, teamData, employeeData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.entities.Team.list('name'),
      base44.entities.Employee.list('first_name'),
    ]);
    const hierarchy = hierarchyRes.data || {};
    setCompanies(hierarchy.companies || []);
    setBranches(hierarchy.branches || []);
    setDepartments(hierarchy.departments || []);
    setDepartmentRoles(hierarchy.departmentRoles || []);
    setTeams(teamData);
    setEmployees((employeeData || []).filter(isNotResigned));
  };

  const createTeam = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await base44.entities.Team.create({ name: name.trim(), member_record_ids: [], status: 'active' });
    setName('');
    loadData();
  };

  const updateTeam = async (e) => {
    e.preventDefault();
    if (!editingTeam || !editName.trim()) return;
    await base44.entities.Team.update(editingTeam.id, { name: editName.trim() });
    setEditingTeam(null);
    setEditName('');
    loadData();
  };

  const availableBranches = selectedCompanyId ? branches.filter(branch => branch.company_id === selectedCompanyId) : branches;
  const availableDepartments = departments.filter(department => {
    const companyMatch = !selectedCompanyId || department.company_id === selectedCompanyId;
    const branchMatch = !selectedBranchId || department.branch_id === selectedBranchId;
    return companyMatch && branchMatch;
  });
  const availableRoles = departmentRoles.filter(role => {
    const companyMatch = !selectedCompanyId || role.company_id === selectedCompanyId;
    const branchMatch = !selectedBranchId || role.branch_id === selectedBranchId;
    const departmentMatch = !selectedDepartmentId || role.department_id === selectedDepartmentId;
    return companyMatch && branchMatch && departmentMatch;
  });
  const filteredTeams = teams.filter(team => {
    const companyMatch = !selectedCompanyId || team.company_id === selectedCompanyId;
    const branchMatch = !selectedBranchId || team.branch_id === selectedBranchId;
    const departmentMatch = !selectedDepartmentId || team.department_id === selectedDepartmentId;
    const roleMatch = !selectedRoleId || team.sub_department_id === selectedRoleId;
    return companyMatch && branchMatch && departmentMatch && roleMatch;
  });

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Teams</h2>
        <p className="text-sm text-muted-foreground mt-1">Create team names only. Employees are assigned to teams in Organization Setup.</p>
      </div>

      <form onSubmit={createTeam} className="bg-card border border-border rounded-xl p-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" />
        <Button type="submit">Create Team</Button>
      </form>

      <div className="bg-card border border-border rounded-xl p-4 grid md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Filter by Company</label>
          <select value={selectedCompanyId} onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedBranchId(''); setSelectedDepartmentId(''); setSelectedRoleId(''); }} className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All companies</option>
            {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Filter by Branch</label>
          <select value={selectedBranchId} onChange={(e) => { setSelectedBranchId(e.target.value); setSelectedDepartmentId(''); setSelectedRoleId(''); }} className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All branches</option>
            {availableBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Filter by Department</label>
          <select value={selectedDepartmentId} onChange={(e) => { setSelectedDepartmentId(e.target.value); setSelectedRoleId(''); }} className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All departments</option>
            {availableDepartments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Filter by Department Role</label>
          <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All department roles</option>
            {availableRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map(team => (
          <SetupCard
            key={team.id}
            title={team.name}
            subtitle={
              <EmployeeListModal
                employees={employees.filter(employee => employee.team_id === team.id)}
                title={`${team.name} Employees`}
                open={employeeModal === team.id}
                onOpen={() => setEmployeeModal(team.id)}
                onClose={() => setEmployeeModal(null)}
              />
            }
            count={employees.filter(employee => employee.team_id === team.id).length}
          >
            <Button variant="secondary" size="sm" className="w-full" onClick={() => { setEditingTeam(team); setEditName(team.name); }}>
              Edit Team
            </Button>
          </SetupCard>
        ))}
      </div>

      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={updateTeam} className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold">Edit Team</h3>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Team name" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingTeam(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
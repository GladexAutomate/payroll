import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, GitBranch, Network, Users, UserRound } from 'lucide-react';
import HierarchyColumn from '@/components/organization/HierarchyColumn';
import EmployeeMapper from '@/components/organization/EmployeeMapper';

export default function OrganizationSetup() {
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentRoles, setDepartmentRoles] = useState([]);
  const [selected, setSelected] = useState({ companyId: '', branchId: '', departmentId: '', roleId: '', teamId: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
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
    setEmployees(employeeData);
    setLoading(false);
  };

  const filteredBranches = useMemo(() => selected.companyId ? branches.filter(branch => branch.company_id === selected.companyId) : [], [branches, selected.companyId]);
  const filteredDepartments = useMemo(() => selected.branchId ? departments.filter(department => department.branch_id === selected.branchId) : [], [departments, selected.branchId]);
  const filteredDepartmentRoles = useMemo(() => selected.departmentId ? departmentRoles.filter(role => role.department_id === selected.departmentId) : [], [departmentRoles, selected.departmentId]);
  const filteredTeams = useMemo(() => selected.roleId ? teams.filter(team => team.sub_department_id === selected.roleId) : [], [teams, selected.roleId]);
  const selectedTeam = teams.find(team => team.id === selected.teamId);

  const updateSelected = (key, value) => {
    const next = { ...selected, [key]: value };
    if (key === 'companyId') Object.assign(next, { branchId: '', departmentId: '', roleId: '', teamId: '' });
    if (key === 'branchId') Object.assign(next, { departmentId: '', roleId: '', teamId: '' });
    if (key === 'departmentId') Object.assign(next, { roleId: '', teamId: '' });
    if (key === 'roleId') Object.assign(next, { teamId: '' });
    setSelected(next);
  };

  const createTeam = async (name) => {
    const department = departments.find(item => item.id === selected.departmentId);
    const created = await base44.entities.Team.create({
      name,
      company_id: selected.companyId,
      branch_id: selected.branchId,
      department_id: selected.departmentId,
      sub_department_id: selected.roleId,
      department_name: department?.name || '',
      member_record_ids: [],
      status: 'active',
    });
    setTeams(prev => [...prev, created]);
    updateSelected('teamId', created.id);
  };

  const assignEmployee = async (employee) => {
    const updated = {
      company_id: selected.companyId,
      branch_id: selected.branchId,
      department_id: selected.departmentId,
      team_id: selected.teamId,
      department_name: departments.find(item => item.id === selected.departmentId)?.name || employee.department_name,
    };
    await base44.entities.Employee.update(employee.id, updated);
    setEmployees(prev => prev.map(item => item.id === employee.id ? { ...item, ...updated } : item));
  };

  const unassignEmployee = async (employee) => {
    const updated = { team_id: '', company_id: '', branch_id: '', department_id: '' };
    await base44.entities.Employee.update(employee.id, updated);
    setEmployees(prev => prev.map(item => item.id === employee.id ? { ...item, ...updated } : item));
  };

  if (loading) {
    return <div className="space-y-3 max-w-6xl">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Organization Setup</h2>
        <p className="text-sm text-muted-foreground mt-1">Company, Branch, Department, and Department Role load from the saved backend copy for faster app performance.</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
        <HierarchyColumn
          title="Company"
          subtitle="Highest organization level"
          items={companies}
          selectedId={selected.companyId}
          onSelect={(id) => updateSelected('companyId', id)}
          readOnly
        />
        <HierarchyColumn
          title="Branch"
          subtitle="Belongs to the selected company"
          items={filteredBranches}
          selectedId={selected.branchId}
          onSelect={(id) => updateSelected('branchId', id)}
          disabled={!selected.companyId}
          readOnly
        />
        <HierarchyColumn
          title="Department"
          subtitle="Belongs to the selected branch"
          items={filteredDepartments}
          selectedId={selected.departmentId}
          onSelect={(id) => updateSelected('departmentId', id)}
          disabled={!selected.branchId}
          readOnly
        />
        <HierarchyColumn
          title="Department Role"
          subtitle="Belongs to the selected department"
          items={filteredDepartmentRoles}
          selectedId={selected.roleId}
          onSelect={(id) => updateSelected('roleId', id)}
          disabled={!selected.departmentId}
          readOnly
        />
        <HierarchyColumn
          title="Team"
          subtitle="Belongs to the selected department role"
          items={filteredTeams}
          selectedId={selected.teamId}
          onSelect={(id) => updateSelected('teamId', id)}
          onCreate={createTeam}
          disabled={!selected.roleId}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { icon: Building2, label: 'Companies', value: companies.length },
          { icon: GitBranch, label: 'Branches', value: filteredBranches.length },
          { icon: Network, label: 'Departments', value: filteredDepartments.length },
          { icon: Users, label: 'Roles', value: filteredDepartmentRoles.length },
          { icon: Users, label: 'Teams', value: filteredTeams.length },
          { icon: UserRound, label: 'Employees', value: selectedTeam ? employees.filter(employee => employee.team_id === selectedTeam.id).length : 0 },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <stat.icon className="w-4 h-4 text-primary mb-2" />
            <p className="text-2xl font-semibold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <EmployeeMapper
        employees={employees}
        selectedTeam={selectedTeam}
        search={search}
        onSearchChange={setSearch}
        onAssign={assignEmployee}
        onUnassign={unassignEmployee}
      />
    </div>
  );
}
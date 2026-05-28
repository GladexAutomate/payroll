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
  const [selected, setSelected] = useState({ companyId: '', branchId: '', departmentId: '', teamId: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [companyData, branchData, departmentRes, teamData, employeeData] = await Promise.all([
      base44.entities.Company.list('name'),
      base44.entities.Branch.list('name'),
      base44.functions.invoke('airtableEmployees', { action: 'departments' }),
      base44.entities.Team.list('name'),
      base44.entities.Employee.list('first_name'),
    ]);
    setCompanies(companyData);
    setBranches(branchData);
    setDepartments(departmentRes.data?.departments || []);
    setTeams(teamData);
    setEmployees(employeeData);
    setLoading(false);
  };

  const filteredBranches = useMemo(() => branches.filter(branch => branch.company_id === selected.companyId), [branches, selected.companyId]);
  const filteredDepartments = useMemo(() => selected.branchId ? departments : [], [departments, selected.branchId]);
  const filteredTeams = useMemo(() => teams.filter(team => team.department_id === selected.departmentId), [teams, selected.departmentId]);
  const selectedTeam = teams.find(team => team.id === selected.teamId);

  const updateSelected = (key, value) => {
    const next = { ...selected, [key]: value };
    if (key === 'companyId') Object.assign(next, { branchId: '', departmentId: '', teamId: '' });
    if (key === 'branchId') Object.assign(next, { departmentId: '', teamId: '' });
    if (key === 'departmentId') Object.assign(next, { teamId: '' });
    setSelected(next);
  };

  const createCompany = async (name) => {
    const created = await base44.entities.Company.create({ name, status: 'active' });
    setCompanies(prev => [...prev, created]);
    updateSelected('companyId', created.id);
  };

  const createBranch = async (name) => {
    const created = await base44.entities.Branch.create({ name, company_id: selected.companyId, status: 'active' });
    setBranches(prev => [...prev, created]);
    updateSelected('branchId', created.id);
  };

  const createTeam = async (name) => {
    const department = departments.find(item => item.id === selected.departmentId);
    const created = await base44.entities.Team.create({
      name,
      company_id: selected.companyId,
      branch_id: selected.branchId,
      department_id: selected.departmentId,
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
        <p className="text-sm text-muted-foreground mt-1">Create and map your structure from Company → Branch → Department → Team → Employee.</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <HierarchyColumn
          title="Company"
          subtitle="Highest organization level"
          items={companies}
          selectedId={selected.companyId}
          onSelect={(id) => updateSelected('companyId', id)}
          onCreate={createCompany}
        />
        <HierarchyColumn
          title="Branch"
          subtitle="Belongs to the selected company"
          items={filteredBranches}
          selectedId={selected.branchId}
          onSelect={(id) => updateSelected('branchId', id)}
          onCreate={createBranch}
          disabled={!selected.companyId}
        />
        <HierarchyColumn
          title="Department"
          subtitle="Select from Airtable departments"
          items={filteredDepartments}
          selectedId={selected.departmentId}
          onSelect={(id) => updateSelected('departmentId', id)}
          onCreate={() => {}}
          disabled={!selected.branchId}
          allowCreate={false}
        />
        <HierarchyColumn
          title="Team"
          subtitle="Belongs to the selected department"
          items={filteredTeams}
          selectedId={selected.teamId}
          onSelect={(id) => updateSelected('teamId', id)}
          onCreate={createTeam}
          disabled={!selected.departmentId}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: Building2, label: 'Companies', value: companies.length },
          { icon: GitBranch, label: 'Branches', value: filteredBranches.length },
          { icon: Network, label: 'Departments', value: filteredDepartments.length },
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
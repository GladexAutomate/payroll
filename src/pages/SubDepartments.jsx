import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import SetupCard from '@/components/organization/SetupCard';
import EmployeeListModal from '@/components/organization/EmployeeListModal';
import GroupHeader from '@/components/organization/GroupHeader';
import { groupByCompanyBranch } from '@/components/organization/groupByCompanyBranch';
import { isNotResigned } from '@/utils/employeeStatus';

export default function DepartmentRoles() {
  const [departmentRoles, setDepartmentRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [employeeModal, setEmployeeModal] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [hierarchyRes, teamData, employeeData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.entities.Team.list('name'),
      base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000),
    ]);
    const hierarchy = hierarchyRes.data || {};
    setCompanies(hierarchy.companies || []);
    setBranches(hierarchy.branches || []);
    setDepartments(hierarchy.departments || []);
    setDepartmentRoles(hierarchy.departmentRoles || []);
    setTeams(teamData);
    setEmployees((employeeData || []).filter(isNotResigned));
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

      <div className="space-y-6">
        {groupByCompanyBranch(filteredDepartmentRoles).map(group => (
          <div key={`${group.company}-${group.branch}`} className="space-y-3">
            <GroupHeader company={group.company} branch={group.branch} count={group.items.length} />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map(departmentRole => (
                <SetupCard
                  key={departmentRole.id}
                  title={departmentRole.name}
                  subtitle={
                    <EmployeeListModal
                      employees={employees.filter(employee => employee.company === departmentRole.company_name && employee.branch === departmentRole.branch_name && employee.department === departmentRole.department_name && employee.department_role === departmentRole.name)}
                      title={`${departmentRole.name} Employees`}
                      open={employeeModal === departmentRole.id}
                      onOpen={() => setEmployeeModal(departmentRole.id)}
                      onClose={() => setEmployeeModal(null)}
                      onUpdated={loadData}
                      categories={{ company: companies, branch: branches, department: departments, department_role: departmentRoles, team: teams }}
                    />
                  }
                >
                  <span className="inline-flex w-fit max-w-full items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 truncate">
                    Department: {departmentRole.department_name || 'Unassigned'}
                  </span>
                </SetupCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
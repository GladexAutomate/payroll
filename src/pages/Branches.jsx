import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import MultiSelectList from '@/components/organization/MultiSelectList';
import SetupCard from '@/components/organization/SetupCard';
import EmployeeListModal from '@/components/organization/EmployeeListModal';
import BranchBrandingModal from '@/components/organization/BranchBrandingModal';
import { Palette } from 'lucide-react';
import { isNotResigned } from '@/utils/employeeStatus';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [employeeModal, setEmployeeModal] = useState(null);
  const [brandings, setBrandings] = useState([]);
  const [brandingBranch, setBrandingBranch] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [hierarchyResponse, departmentData, employeeData, brandingData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.entities.Department.list('name'),
      base44.entities.AirtableEmployeeRecord.list('-updated_date', 5000),
      base44.entities.BranchBranding.list('-updated_date', 1000),
    ]);
    setBrandings(brandingData || []);

    const mergedDepartments = new Map();
    for (const department of (hierarchyResponse.data?.departments || [])) {
      mergedDepartments.set(`${department.name}-${department.branch_id || ''}`.toLowerCase(), department);
    }
    for (const department of (departmentData || [])) {
      mergedDepartments.set(`${department.name}-${department.branch_id || ''}`.toLowerCase(), department);
    }

    setCompanies(hierarchyResponse.data?.companies || []);
    setBranches(hierarchyResponse.data?.branches || []);
    setDepartments(Array.from(mergedDepartments.values()).sort((a, b) => a.name.localeCompare(b.name)));
    setEmployees((employeeData || []).filter(isNotResigned));
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

  const filteredBranches = selectedCompanyId
    ? branches.filter(branch => branch.company_id === selectedCompanyId)
    : branches;

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Branches</h2>
        <p className="text-sm text-muted-foreground mt-1">Branches load from the saved backend copy of Airtable records.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-semibold text-muted-foreground">Filter by Company</label>
        <select
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          className="mt-2 h-9 w-full md:w-80 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All companies</option>
          {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Loading branches from backend records...
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map(branch => (
            <SetupCard
              key={branch.id}
              title={branch.name}
              logoUrl={brandings.find(b => b.branch_id === branch.id)?.logo_url}
              subtitle={
                <EmployeeListModal
                  employees={employees.filter(employee => employee.company === branch.company_name && employee.branch === branch.name)}
                  title={`${branch.name} Employees`}
                  open={employeeModal === branch.id}
                  onOpen={() => setEmployeeModal(branch.id)}
                  onClose={() => setEmployeeModal(null)}
                  onUpdated={loadData}
                  categories={{ company: companies, branch: branches, department: departments, department_role: [], team: [] }}
                />
              }
              count={departments.filter(department => department.branch_id === branch.id).length}
              onManage={() => openMapping(branch)}
            >
              <span className="inline-flex w-fit max-w-full items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary truncate">
                Company: {branch.company_name || 'Unassigned'}
              </span>
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setBrandingBranch(branch)}>
                <Palette className="w-3.5 h-3.5 mr-1.5" />
                {brandings.some(b => b.branch_id === branch.id) ? 'Edit Branding' : 'Add Branding'}
              </Button>
            </SetupCard>
          ))}
        </div>
      )}

      {brandingBranch && (
        <BranchBrandingModal
          branch={brandingBranch}
          branding={brandings.find(b => b.branch_id === brandingBranch.id)}
          onClose={() => setBrandingBranch(null)}
          onSaved={() => { setBrandingBranch(null); loadData(); }}
        />
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
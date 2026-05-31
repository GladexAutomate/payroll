import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const employeeName = (employee) => `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.employee_id;

export default function EmployeeMapper({ employees, selectedTeam, scope = {}, search, onSearchChange, onAssign, onUnassign }) {
  const assigned = selectedTeam ? employees.filter(employee => employee.team_id === selectedTeam.id) : [];
  const available = selectedTeam
    ? employees.filter(employee =>
        employee.team_id !== selectedTeam.id &&
        (!scope.companyId || employee.company_id === scope.companyId) &&
        (!scope.branchId || employee.branch_id === scope.branchId) &&
        (!scope.departmentId || employee.department_id === scope.departmentId)
      )
    : [];
  const filteredAvailable = available.filter(employee => employeeName(employee).toLowerCase().includes(search.toLowerCase()) || (employee.employee_id || '').toLowerCase().includes(search.toLowerCase()));

  if (!selectedTeam) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
        Select a team first to assign employees.
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-sm">Assigned Employees</h3>
          <p className="text-xs text-muted-foreground">Employees mapped to {selectedTeam.name}</p>
        </div>
        <div className="space-y-2 max-h-80 overflow-auto">
          {assigned.length === 0 ? <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">No employees assigned yet.</p> : assigned.map(employee => (
            <div key={employee.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{employeeName(employee)}</p>
                <p className="text-xs text-muted-foreground">{employee.employee_id}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onUnassign(employee)}>Remove</Button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-sm">Available Employees</h3>
          <p className="text-xs text-muted-foreground">Assign employees into this team</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search employees..." />
        </div>
        <div className="space-y-2 max-h-80 overflow-auto">
          {filteredAvailable.length === 0 ? <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">No available employees found.</p> : filteredAvailable.map(employee => (
            <div key={employee.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{employeeName(employee)}</p>
                <p className="text-xs text-muted-foreground">{employee.employee_id}</p>
              </div>
              <Button size="sm" onClick={() => onAssign(employee)}>Assign</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
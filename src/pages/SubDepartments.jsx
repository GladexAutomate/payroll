import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import MultiSelectList from '@/components/organization/MultiSelectList';
import SetupCard from '@/components/organization/SetupCard';

export default function DepartmentRoles() {
  const [departmentRoles, setDepartmentRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedDepartmentRole, setSelectedDepartmentRole] = useState(null);
  const [selectedTeams, setSelectedTeams] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [roleRes, teamData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'departmentRoles' }),
      base44.entities.Team.list('name'),
    ]);
    setDepartmentRoles(roleRes.data?.departmentRoles || []);
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

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Department Roles</h2>
        <p className="text-sm text-muted-foreground mt-1">Department roles load from the saved backend copy of Airtable records.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departmentRoles.map(departmentRole => (
          <SetupCard
            key={departmentRole.id}
            title={departmentRole.name}
            subtitle={`${departmentRole.employee_count || 0} employees in Airtable`}
            count={teams.filter(team => team.sub_department_id === departmentRole.id).length}
            onManage={() => openMapping(departmentRole)}
          />
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
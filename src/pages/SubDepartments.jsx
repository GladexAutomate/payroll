import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiSelectList from '@/components/organization/MultiSelectList';
import SetupCard from '@/components/organization/SetupCard';

export default function SubDepartments() {
  const [subDepartments, setSubDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState('');
  const [selectedSubDepartment, setSelectedSubDepartment] = useState(null);
  const [selectedTeams, setSelectedTeams] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [subDepartmentData, teamData] = await Promise.all([
      base44.entities.SubDepartment.list('name'),
      base44.entities.Team.list('name'),
    ]);
    setSubDepartments(subDepartmentData);
    setTeams(teamData);
  };

  const createSubDepartment = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await base44.entities.SubDepartment.create({ name: name.trim(), status: 'active' });
    setName('');
    loadData();
  };

  const openMapping = (subDepartment) => {
    setSelectedSubDepartment(subDepartment);
    setSelectedTeams(teams.filter(team => team.sub_department_id === subDepartment.id).map(team => team.id));
  };

  const saveMapping = async () => {
    for (const team of teams) {
      if (selectedTeams.includes(team.id) && team.sub_department_id !== selectedSubDepartment.id) {
        await base44.entities.Team.update(team.id, {
          sub_department_id: selectedSubDepartment.id,
          department_id: selectedSubDepartment.department_id || team.department_id || '',
          branch_id: selectedSubDepartment.branch_id || team.branch_id || '',
          company_id: selectedSubDepartment.company_id || team.company_id || '',
        });
      }
    }
    setSelectedSubDepartment(null);
    loadData();
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-lg">Sub Departments</h2>
        <p className="text-sm text-muted-foreground mt-1">Create sub departments and choose which teams are under each one.</p>
      </div>

      <form onSubmit={createSubDepartment} className="bg-card border border-border rounded-xl p-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sub department name" />
        <Button type="submit">Create Sub Department</Button>
      </form>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subDepartments.map(subDepartment => (
          <SetupCard
            key={subDepartment.id}
            title={subDepartment.name}
            count={teams.filter(team => team.sub_department_id === subDepartment.id).length}
            onManage={() => openMapping(subDepartment)}
          />
        ))}
      </div>

      {selectedSubDepartment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Map Teams to {selectedSubDepartment.name}</h3>
              <p className="text-sm text-muted-foreground">Select existing teams under this sub department.</p>
            </div>
            <MultiSelectList items={teams} selectedIds={selectedTeams} onToggle={(id) => setSelectedTeams(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedSubDepartment(null)}>Cancel</Button>
              <Button onClick={saveMapping}>Save Mapping</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
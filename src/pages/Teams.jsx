import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SetupCard from '@/components/organization/SetupCard';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [teamData, employeeData] = await Promise.all([
      base44.entities.Team.list('name'),
      base44.entities.Employee.list('first_name'),
    ]);
    setTeams(teamData);
    setEmployees(employeeData);
  };

  const createTeam = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await base44.entities.Team.create({ name: name.trim(), member_record_ids: [], status: 'active' });
    setName('');
    loadData();
  };

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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(team => (
          <SetupCard
            key={team.id}
            title={team.name}
            subtitle="Employees added from Organization Setup"
            count={employees.filter(employee => employee.team_id === team.id).length}
          />
        ))}
      </div>
    </div>
  );
}
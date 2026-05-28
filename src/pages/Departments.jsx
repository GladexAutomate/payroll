import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeDepartment, setActiveDepartment] = useState(null);
  const [subDepartmentName, setSubDepartmentName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [res, subDepartmentData, teamData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.entities.SubDepartment.list('name'),
      base44.entities.Team.list('name'),
    ]);

    const mergedRoles = new Map();
    for (const role of (res.data?.departmentRoles || [])) {
      mergedRoles.set(`${role.name}-${role.department_id || ''}`.toLowerCase(), role);
    }
    for (const role of (subDepartmentData || [])) {
      mergedRoles.set(`${role.name}-${role.department_id || ''}`.toLowerCase(), role);
    }

    setDepartments(res.data?.departments || []);
    setSubDepartments(Array.from(mergedRoles.values()).sort((a, b) => a.name.localeCompare(b.name)));
    setTeams(teamData);
    setLoading(false);
  };

  const createSubDepartment = async (e) => {
    e.preventDefault();
    if (!activeDepartment || !subDepartmentName.trim()) return;
    await base44.entities.SubDepartment.create({
      name: subDepartmentName.trim(),
      department_id: activeDepartment.id,
      department_name: activeDepartment.name,
      status: 'active',
    });
    setSubDepartmentName('');
    loadData();
  };

  const createTeam = async (e) => {
    e.preventDefault();
    if (!activeDepartment || !teamName.trim()) return;
    await base44.entities.Team.create({
      name: teamName.trim(),
      department_id: activeDepartment.id,
      department_name: activeDepartment.name,
      member_record_ids: [],
      status: 'active',
    });
    setTeamName('');
    loadData();
  };

  const updateItem = async (e) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;
    const entity = editingItem.type === 'team' ? base44.entities.Team : base44.entities.SubDepartment;
    await entity.update(editingItem.item.id, { name: editName.trim() });
    setEditingItem(null);
    setEditName('');
    loadData();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base">Departments</h2>
          <p className="text-sm text-muted-foreground">These departments load from the saved backend copy of Airtable records.</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />)
        ) : departments.length === 0 ? (
          <div className="col-span-full bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            No departments found in Airtable yet.
          </div>
        ) : departments.map(dept => (
          <div key={dept.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{dept.name}</p>
                {dept.code && <p className="text-xs text-muted-foreground">{dept.code}</p>}
                <p className="text-xs text-muted-foreground truncate mt-1">Company: {dept.company_name || 'Unassigned'}</p>
                <p className="text-xs text-muted-foreground truncate">Branch: {dept.branch_name || 'Unassigned'}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{dept.employee_count || 0} employees</span>
              <span className="text-xs text-primary font-medium">Airtable</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>{subDepartments.filter(item => item.department_id === dept.id).length} department roles</span>
              <span>{teams.filter(item => item.department_id === dept.id).length} teams</span>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setActiveDepartment(dept)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Under Department
            </Button>
          </div>
        ))}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={updateItem} className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold">Edit {editingItem.type === 'team' ? 'Team' : 'Department Role'}</h3>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </div>
      )}

      {activeDepartment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-5">
            <div>
              <h3 className="font-semibold">Add under {activeDepartment.name}</h3>
              <p className="text-sm text-muted-foreground">Create department roles and teams connected to this department.</p>
            </div>

            <form onSubmit={createSubDepartment} className="space-y-2">
              <p className="text-sm font-medium">Department Role</p>
              <div className="flex gap-2">
                <Input value={subDepartmentName} onChange={(e) => setSubDepartmentName(e.target.value)} placeholder="Department role name" />
                <Button type="submit">Create</Button>
              </div>
            </form>

            <form onSubmit={createTeam} className="space-y-2">
              <p className="text-sm font-medium">Team</p>
              <div className="flex gap-2">
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name" />
                <Button type="submit">Create</Button>
              </div>
            </form>

            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border p-3">
                <p className="font-medium mb-2">Department Roles</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {subDepartments.filter(item => item.department_id === activeDepartment.id).map(item => (
                    <button key={item.id} className="block w-full text-left hover:text-foreground" onClick={() => { setEditingItem({ type: 'subDepartment', item }); setEditName(item.name); }}>
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="font-medium mb-2">Teams</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {teams.filter(item => item.department_id === activeDepartment.id).map(item => (
                    <button key={item.id} className="block w-full text-left hover:text-foreground" onClick={() => { setEditingItem({ type: 'team', item }); setEditName(item.name); }}>
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setActiveDepartment(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
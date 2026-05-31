import { useEffect, useMemo, useState } from 'react';
import { Link2, Building2, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ScheduleLinkRow from '@/components/schedule/ScheduleLinkRow';

// Section wrapper for a group of links.
function LinkSection({ icon: Icon, title, count, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function ScheduleLinks() {
  const [hierarchy, setHierarchy] = useState({ companies: [], branches: [], departments: [], departmentRoles: [] });
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [org, teamData] = await Promise.all([
      base44.functions.invoke('airtableEmployees', { action: 'organizationHierarchy' }),
      base44.entities.Team.list('name', 1000),
    ]);
    setHierarchy(org.data || { companies: [], branches: [], departments: [], departmentRoles: [] });
    setTeams(teamData || []);
    setLoading(false);
  };

  const branches = hierarchy.branches || [];
  const departments = hierarchy.departments || [];
  const roles = hierarchy.departmentRoles || [];

  const activeTeams = useMemo(() => teams.filter(t => t.status !== 'inactive'), [teams]);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">Approved Schedule Links</h2>
            <p className="text-xs text-muted-foreground">Each link opens the approved schedule filtered to that group. Copy and share the URL.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading links...</div>
      ) : (
        <>
          <LinkSection icon={Building2} title="Per Branch" count={branches.length}>
            {branches.map(b => (
              <ScheduleLinkRow
                key={b.id}
                label={`${b.name}${b.company_name ? ` — ${b.company_name}` : ''}`}
                scope="branch"
                value={[b.company_name || '', b.name].join('|')}
              />
            ))}
            {branches.length === 0 && <p className="text-xs text-muted-foreground">No branches found.</p>}
          </LinkSection>

          <LinkSection icon={Building2} title="Per Department" count={departments.length}>
            {departments.map(d => (
              <ScheduleLinkRow
                key={d.id}
                label={`${d.name}${d.branch_name ? ` — ${d.branch_name}` : ''}`}
                scope="department"
                value={[d.company_name || '', d.branch_name || '', d.name].join('|')}
              />
            ))}
            {departments.length === 0 && <p className="text-xs text-muted-foreground">No departments found.</p>}
          </LinkSection>

          <LinkSection icon={Building2} title="Per Department Role" count={roles.length}>
            {roles.map(r => (
              <ScheduleLinkRow
                key={r.id}
                label={`${r.name}${r.department_name ? ` · ${r.department_name}` : ''}${r.branch_name ? ` — ${r.branch_name}` : ''}`}
                scope="department_role"
                value={[r.company_name || '', r.branch_name || '', r.department_name || '', r.name].join('|')}
              />
            ))}
            {roles.length === 0 && <p className="text-xs text-muted-foreground">No department roles found.</p>}
          </LinkSection>

          <LinkSection icon={Users} title="Per Team" count={activeTeams.length}>
            {activeTeams.map(t => <ScheduleLinkRow key={t.id} label={t.name} scope="team" value={t.name} />)}
            {activeTeams.length === 0 && <p className="text-xs text-muted-foreground">No teams found.</p>}
          </LinkSection>
        </>
      )}
    </div>
  );
}
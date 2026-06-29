import { useEffect, useMemo, useState } from 'react';
import { Link2, Building2, Users, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import ScheduleLinkRow from '@/components/schedule/ScheduleLinkRow';

const pathKey = (...parts) => parts.map(part => String(part || '').trim().toLowerCase()).join('|');
const pathValue = (...parts) => parts.map(part => String(part || '').trim()).join('|');

// Keep the latest entry per group key. Proposals are pre-sorted newest-period-first, so the
// first one seen for a key wins — giving each link that group's most recent plotted period.
const uniqueRows = (items, getKey, buildRow) => {
  const rows = new Map();
  items.forEach(item => {
    const key = getKey(item);
    if (!key || rows.has(key)) return;
    rows.set(key, buildRow(item));
  });
  return Array.from(rows.values()).sort((a, b) => String(a.label || a.name).localeCompare(String(b.label || b.name)));
};

export default function ScheduleLinks() {
  const [approvedProposals, setApprovedProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const proposalData = await base44.entities.AttendanceProposal.list('-created_date', 1000);
      setApprovedProposals(proposalData || []);
    } catch {
      setApprovedProposals([]);
    } finally {
      setLoading(false);
    }
  };

  // Every approved schedule gets a link, regardless of pay period. Approval auto-plots the
  // schedule, so an approved proposal always has a viewable schedule behind its link.
  // Sort newest-period-first so each group's link opens on its most recent plotted period;
  // the read-only view's period picker still lets you browse the full history inside the link.
  const scheduleProposals = useMemo(() => (
    approvedProposals
      .filter(proposal => proposal.status === 'approved')
      .sort((a, b) => String(b.period_end || '').localeCompare(String(a.period_end || '')))
  ), [approvedProposals]);

  const branches = useMemo(() => uniqueRows(
    scheduleProposals,
    proposal => pathKey(proposal.company_name, proposal.branch_name),
    proposal => ({
      id: pathValue(proposal.company_name, proposal.branch_name),
      label: `${proposal.branch_name || 'Branch'}${proposal.company_name ? ` - ${proposal.company_name}` : ''}`,
      value: pathValue(proposal.company_name, proposal.branch_name),
      periodStart: proposal.period_start,
      periodEnd: proposal.period_end,
    })
  ), [scheduleProposals]);

  const departments = useMemo(() => uniqueRows(
    scheduleProposals,
    proposal => pathKey(proposal.company_name, proposal.branch_name, proposal.department_name),
    proposal => ({
      id: pathValue(proposal.company_name, proposal.branch_name, proposal.department_name),
      label: `${proposal.department_name || 'Department'}${proposal.branch_name ? ` - ${proposal.branch_name}` : ''}`,
      value: pathValue(proposal.company_name, proposal.branch_name, proposal.department_name),
      periodStart: proposal.period_start,
      periodEnd: proposal.period_end,
    })
  ), [scheduleProposals]);

  const roles = useMemo(() => uniqueRows(
    scheduleProposals,
    proposal => pathKey(proposal.company_name, proposal.branch_name, proposal.department_name, proposal.department_role),
    proposal => ({
      id: pathValue(proposal.company_name, proposal.branch_name, proposal.department_name, proposal.department_role),
      label: `${proposal.department_role || 'Department Role'}${proposal.department_name ? ` - ${proposal.department_name}` : ''}${proposal.branch_name ? ` - ${proposal.branch_name}` : ''}`,
      value: pathValue(proposal.company_name, proposal.branch_name, proposal.department_name, proposal.department_role),
      periodStart: proposal.period_start,
      periodEnd: proposal.period_end,
    })
  ), [scheduleProposals]);

  const teams = useMemo(() => uniqueRows(
    scheduleProposals,
    // Name each team link after its leader/creator (the immediate-head flow is leader-scoped).
    // Group by leader, falling back to team_name then the proposal id so a proposal with neither
    // is still listed — uniqueRows drops empty keys.
    proposal => pathKey(proposal.leader_name) || pathKey(proposal.team_name) || pathKey(proposal.id),
    proposal => ({
      id: proposal.id,
      name: proposal.leader_name ? `${proposal.leader_name}'s Team` : (proposal.team_name || 'Team'),
      // Scope by team name so the link aggregates every period for this team (full history).
      // Fall back to "|<proposal id>" when there's no team name to scope by.
      value: proposal.team_name ? pathValue(proposal.team_name) : pathValue('', proposal.id),
      periodStart: proposal.period_start,
      periodEnd: proposal.period_end,
    })
  ), [scheduleProposals]);

  const q = search.trim().toLowerCase();
  const matches = (text) => !q || String(text || '').toLowerCase().includes(q);
  const filteredBranches = useMemo(() => branches.filter(b => matches(b.label)), [branches, q]);
  const filteredDepartments = useMemo(() => departments.filter(d => matches(d.label)), [departments, q]);
  const filteredRoles = useMemo(() => roles.filter(r => matches(r.label)), [roles, q]);
  const filteredTeams = useMemo(() => teams.filter(t => matches(t.name)), [teams, q]);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">Approved Schedule Links</h2>
            <p className="text-xs text-muted-foreground">Every approved schedule has a link. Each opens on its most recent plotted period — use the period picker inside to view the group&apos;s complete schedule history.</p>
          </div>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search branch, department, role, or team..." className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading approved schedule links...</div>
      ) : (
        <>
          <LinkSection icon={Building2} title="Per Branch" count={filteredBranches.length}>
            {filteredBranches.map(branch => (
              <ScheduleLinkRow key={branch.id} label={branch.label} scope="branch" value={branch.value} periodStart={branch.periodStart} periodEnd={branch.periodEnd} />
            ))}
            {filteredBranches.length === 0 && <p className="text-xs text-muted-foreground">No matching branch schedules found.</p>}
          </LinkSection>

          <LinkSection icon={Building2} title="Per Department" count={filteredDepartments.length}>
            {filteredDepartments.map(department => (
              <ScheduleLinkRow key={department.id} label={department.label} scope="department" value={department.value} periodStart={department.periodStart} periodEnd={department.periodEnd} />
            ))}
            {filteredDepartments.length === 0 && <p className="text-xs text-muted-foreground">No matching department schedules found.</p>}
          </LinkSection>

          <LinkSection icon={Building2} title="Per Department Role" count={filteredRoles.length}>
            {filteredRoles.map(role => (
              <ScheduleLinkRow key={role.id} label={role.label} scope="department_role" value={role.value} periodStart={role.periodStart} periodEnd={role.periodEnd} />
            ))}
            {filteredRoles.length === 0 && <p className="text-xs text-muted-foreground">No matching role schedules found.</p>}
          </LinkSection>

          <LinkSection icon={Users} title="Per Team" count={filteredTeams.length}>
            {filteredTeams.map(team => (
              <ScheduleLinkRow key={team.id} label={team.name} scope="team" value={team.value} periodStart={team.periodStart} periodEnd={team.periodEnd} />
            ))}
            {filteredTeams.length === 0 && <p className="text-xs text-muted-foreground">No matching team schedules found.</p>}
          </LinkSection>
        </>
      )}
    </div>
  );
}

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

import { useEffect, useMemo, useState } from 'react';
import { Link2, Building2, Users, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import ScheduleLinkRow from '@/components/schedule/ScheduleLinkRow';

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

const pathKey = (...parts) => parts.map(part => String(part || '').trim().toLowerCase()).join('|');
const pathValue = (...parts) => parts.map(part => String(part || '').trim()).join('|');
const formatDate = (date) => date.toISOString().slice(0, 10);

const getCurrentPayPeriod = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstHalf = today.getDate() <= 15;
  return {
    start: formatDate(new Date(year, month, firstHalf ? 1 : 16)),
    end: formatDate(firstHalf ? new Date(year, month, 15) : new Date(year, month + 1, 0)),
  };
};

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
  const [plottedSourceIds, setPlottedSourceIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const period = getCurrentPayPeriod();
      const [proposalData, plottedData] = await Promise.all([
        base44.entities.AttendanceProposal.list('-created_date', 1000),
        base44.entities.ApprovedSchedule.filter({ date: { $gte: period.start, $lte: period.end } }, '-date', 5000),
      ]);
      setApprovedProposals(proposalData || []);
      setPlottedSourceIds(new Set((plottedData || []).map(row => row.source_proposal_id).filter(Boolean).map(String)));
    } catch {
      setApprovedProposals([]);
      setPlottedSourceIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const scheduleProposals = useMemo(() => (
    approvedProposals.filter(proposal => plottedSourceIds.has(String(proposal.id)))
  ), [approvedProposals, plottedSourceIds]);

  const branches = useMemo(() => uniqueRows(
    scheduleProposals,
    proposal => pathKey(proposal.company_name, proposal.branch_name),
    proposal => ({
      id: pathValue(proposal.company_name, proposal.branch_name),
      label: `${proposal.branch_name || 'Branch'}${proposal.company_name ? ` - ${proposal.company_name}` : ''}`,
      value: pathValue(proposal.company_name, proposal.branch_name),
    })
  ), [scheduleProposals]);

  const departments = useMemo(() => uniqueRows(
    scheduleProposals,
    proposal => pathKey(proposal.company_name, proposal.branch_name, proposal.department_name),
    proposal => ({
      id: pathValue(proposal.company_name, proposal.branch_name, proposal.department_name),
      label: `${proposal.department_name || 'Department'}${proposal.branch_name ? ` - ${proposal.branch_name}` : ''}`,
      value: pathValue(proposal.company_name, proposal.branch_name, proposal.department_name),
    })
  ), [scheduleProposals]);

  const roles = useMemo(() => uniqueRows(
    scheduleProposals,
    proposal => pathKey(proposal.company_name, proposal.branch_name, proposal.department_name, proposal.department_role),
    proposal => ({
      id: pathValue(proposal.company_name, proposal.branch_name, proposal.department_name, proposal.department_role),
      label: `${proposal.department_role || 'Department Role'}${proposal.department_name ? ` - ${proposal.department_name}` : ''}${proposal.branch_name ? ` - ${proposal.branch_name}` : ''}`,
      value: pathValue(proposal.company_name, proposal.branch_name, proposal.department_name, proposal.department_role),
    })
  ), [scheduleProposals]);

  const teams = useMemo(() => uniqueRows(
    scheduleProposals,
    proposal => pathKey(proposal.team_name),
    proposal => ({
      id: proposal.id,
      name: proposal.team_name || 'Team',
      value: pathValue(proposal.team_name, proposal.id),
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
            <p className="text-xs text-muted-foreground">Each link opens an approved plotted schedule filtered to that group.</p>
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
              <ScheduleLinkRow key={branch.id} label={branch.label} scope="branch" value={branch.value} />
            ))}
            {filteredBranches.length === 0 && <p className="text-xs text-muted-foreground">No matching branch schedules found.</p>}
          </LinkSection>

          <LinkSection icon={Building2} title="Per Department" count={filteredDepartments.length}>
            {filteredDepartments.map(department => (
              <ScheduleLinkRow key={department.id} label={department.label} scope="department" value={department.value} />
            ))}
            {filteredDepartments.length === 0 && <p className="text-xs text-muted-foreground">No matching department schedules found.</p>}
          </LinkSection>

          <LinkSection icon={Building2} title="Per Department Role" count={filteredRoles.length}>
            {filteredRoles.map(role => (
              <ScheduleLinkRow key={role.id} label={role.label} scope="department_role" value={role.value} />
            ))}
            {filteredRoles.length === 0 && <p className="text-xs text-muted-foreground">No matching role schedules found.</p>}
          </LinkSection>

          <LinkSection icon={Users} title="Per Team" count={filteredTeams.length}>
            {filteredTeams.map(team => (
              <ScheduleLinkRow key={team.id} label={team.name} scope="team" value={team.value} />
            ))}
            {filteredTeams.length === 0 && <p className="text-xs text-muted-foreground">No matching team schedules found.</p>}
          </LinkSection>
        </>
      )}
    </div>
  );
}
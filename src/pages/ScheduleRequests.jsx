import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RequestToolbar from '@/components/schedule/RequestToolbar';
import RequestCard from '@/components/schedule/RequestCard';
import RejectReasonDialog from '@/components/schedule/RejectReasonDialog';

export default function ScheduleRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending_hr_review');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [confirm, setConfirm] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // { ids: [...] }

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    setLoading(true);
    const [data, shifts] = await Promise.all([
      base44.entities.AttendanceProposal.list('-created_date', 100),
      base44.entities.ShiftTemplate.list('sort_order'),
    ]);
    setRequests(data);
    setShiftTemplates(shifts || []);
    setSelected(new Set());
    setLoading(false);
  };

  const counts = useMemo(() => requests.reduce((m, r) => ({ ...m, all: (m.all || 0) + 1, [r.status]: (m[r.status] || 0) + 1 }), {}), [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = filter === 'all' ? requests : requests.filter(r => r.status === filter);
    if (q) {
      list = list.filter(r =>
        (r.team_name || '').toLowerCase().includes(q) ||
        (r.leader_name || '').toLowerCase().includes(q) ||
        (r.leader_email || '').toLowerCase().includes(q) ||
        (r.department_name || '').toLowerCase().includes(q) ||
        (r.branch_name || '').toLowerCase().includes(q) ||
        (r.company_name || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sort === 'oldest') sorted.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    else if (sort === 'team') sorted.sort((a, b) => (a.team_name || '').localeCompare(b.team_name || ''));
    else sorted.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    return sorted;
  }, [requests, filter, search, sort]);

  // Group by company / branch
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const key = `${r.company_name || 'Company'}${r.branch_name ? ' — ' + r.branch_name : ''}`;
      (map[key] = map[key] || []).push(r);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const pendingInView = filtered.filter(r => r.status === 'pending_hr_review');
  const allSelected = pendingInView.length > 0 && pendingInView.every(r => selected.has(r.id));

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(pendingInView.map(r => r.id)));
  const toggleGroup = (key) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const applyStatus = async (ids, status, reason = '') => {
    for (const id of ids) {
      const request = requests.find(r => r.id === id);
      if (!request) continue;
      setBusyId(id);
      await base44.entities.AttendanceProposal.update(id, {
        status,
        reviewed_date: new Date().toISOString(),
        ...(status === 'rejected' ? { notes: reason } : {}),
      });
      await base44.functions.invoke('scheduleWebhook', { proposalId: id, eventType: status });
      if (status === 'approved') {
        await base44.functions.invoke('plotApprovedSchedule', { proposalId: id });
      } else if (status === 'rejected') {
        // If this proposal was previously approved & plotted, remove its rows from the Approved Schedule.
        await base44.functions.invoke('unplotApprovedSchedule', { proposalId: id });
      }
    }
    setBusyId(null);
    await loadRequests();
  };

  const askApprove = (request) => setConfirm({
    title: 'Approve schedule?',
    description: `Approve "${request.team_name}"? This plots the schedule onto the Approved Schedule for the period.`,
    confirmLabel: 'Approve',
    onConfirm: () => { setConfirm(null); applyStatus([request.id], 'approved'); },
  });
  const askBulkApprove = () => setConfirm({
    title: `Approve ${selected.size} schedules?`,
    description: 'This plots every selected schedule onto the Approved Schedule for its period.',
    confirmLabel: 'Approve all',
    onConfirm: () => { setConfirm(null); applyStatus([...selected], 'approved'); },
  });

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-background rounded-xl p-4 text-slate-900 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Schedule Requests</h2>
          <p className="text-sm text-slate-500">Review and approve team schedule proposals</p>
        </div>
      </div>

      <RequestToolbar
        filter={filter} setFilter={setFilter} counts={counts}
        search={search} setSearch={setSearch} sort={sort} setSort={setSort}
      />

      {/* Bulk action bar */}
      {pendingInView.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
            Select all pending ({pendingInView.length})
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-slate-500">{selected.size} selected</span>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={askBulkApprove}>
                  <CheckCircle className="w-4 h-4 mr-1" /> Approve selected
                </Button>
                <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={() => setRejectTarget({ ids: [...selected] })}>
                  <XCircle className="w-4 h-4 mr-1" /> Reject selected
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl p-8 text-center text-sm text-slate-500">Loading schedule requests...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-sm text-slate-500">No schedule requests found.</div>
      ) : groups.map(([groupKey, items]) => {
        const collapsed = collapsedGroups.has(groupKey);
        return (
          <div key={groupKey} className="space-y-3">
            <button onClick={() => toggleGroup(groupKey)} className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {groupKey}
              <span className="text-xs font-normal text-slate-400">({items.length})</span>
            </button>
            {!collapsed && (
              <div className="space-y-3">
                {items.map(request => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    shiftTemplates={shiftTemplates}
                    expanded={expandedId === request.id}
                    onToggle={() => setExpandedId(expandedId === request.id ? null : request.id)}
                    selected={selected.has(request.id)}
                    onSelect={toggleSelect}
                    onApprove={askApprove}
                    onReject={(r) => setRejectTarget({ ids: [r.id] })}
                    busy={busyId === request.id}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={confirm?.onConfirm}
      />

      {rejectTarget && (
        <RejectReasonDialog
          count={rejectTarget.ids.length}
          onCancel={() => setRejectTarget(null)}
          onConfirm={async (reason) => {
            const ids = rejectTarget.ids;
            setRejectTarget(null);
            await applyStatus(ids, 'rejected', reason);
          }}
        />
      )}
    </div>
  );
}
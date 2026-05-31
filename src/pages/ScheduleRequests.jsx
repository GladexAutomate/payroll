import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, CheckCircle, Eye, EyeOff, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ScheduleGrid from '@/components/schedule/ScheduleGrid';
import ScheduleAnalytics from '@/components/schedule/ScheduleAnalytics';
import { buildScheduleSummary } from '@/components/schedule/scheduleUtils';

const filters = [
  { key: 'all', label: 'All' },
  { key: 'pending_hr_review', label: 'Pending HR Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const statusLabels = {
  pending_hr_review: 'Pending HR Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function ScheduleRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    setLoading(true);
    const data = await base44.entities.AttendanceProposal.list('-created_date', 100);
    setRequests(data);
    setLoading(false);
  };

  const filtered = useMemo(() => filter === 'all' ? requests : requests.filter(req => req.status === filter), [requests, filter]);

  const updateStatus = async (request, status) => {
    setBusyId(request.id);
    await base44.entities.AttendanceProposal.update(request.id, {
      status,
      reviewed_date: new Date().toISOString(),
    });
    await base44.functions.invoke('scheduleWebhook', { proposalId: request.id, eventType: status });
    if (status === 'approved') {
      await base44.functions.invoke('plotApprovedSchedule', { proposalId: request.id });
    }
    setBusyId(null);
    loadRequests();
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-background rounded-xl p-4 text-slate-900 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Schedule Requests</h2>
          <p className="text-sm text-slate-500">Review and approve team schedule proposals</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map(item => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${filter === item.key ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-300 text-slate-600 hover:text-slate-900'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-8 text-center text-sm text-slate-500">Loading schedule requests...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-sm text-slate-500">No schedule requests found.</div>
      ) : filtered.map(request => {
        const expanded = expandedId === request.id;
        const summary = request.summary?.dailyRows ? request.summary : buildScheduleSummary({ employees: request.employees || [], assignments: request.assignments || {}, periodStart: request.period_start, periodEnd: request.period_end });
        return (
          <div key={request.id} className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">{request.team_name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">{statusLabels[request.status] || request.status}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{request.company_name || 'Company'} {request.branch_name ? `/ ${request.branch_name}` : ''} {request.department_name ? `/ ${request.department_name}` : ''}</p>
                <p className="text-sm text-slate-700 mt-1 flex items-center gap-1"><Calendar className="w-4 h-4" /> {request.period_start ? format(parseISO(request.period_start), 'MMM d') : '—'} - {request.period_end ? format(parseISO(request.period_end), 'd, yyyy') : '—'}</p>
                <p className="text-xs text-slate-500 mt-1">Leader: {request.leader_name || '—'} {request.leader_email ? `· ${request.leader_email}` : ''}</p>
              </div>
              <div className="flex lg:flex-col gap-2 min-w-[150px]">
                <Button type="button" variant="secondary" size="sm" onClick={() => setExpandedId(expanded ? null : request.id)}>
                  {expanded ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />} {expanded ? 'Hide' : 'View'}
                </Button>
                <Button type="button" size="sm" className="bg-green-500 hover:bg-green-600" disabled={busyId === request.id || request.status === 'approved'} onClick={() => updateStatus(request, 'approved')}>
                  <CheckCircle className="w-4 h-4 mr-1" /> Approve Schedule
                </Button>
                <Button type="button" size="sm" className="bg-red-500 hover:bg-red-600" disabled={busyId === request.id || request.status === 'rejected'} onClick={() => updateStatus(request, 'rejected')}>
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
              </div>
            </div>

            {expanded && (
              <div className="border-t border-slate-200 p-5 space-y-5">
                <ScheduleGrid employees={request.employees || []} assignments={request.assignments || {}} periodStart={request.period_start} periodEnd={request.period_end} />
                <ScheduleAnalytics summary={summary} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
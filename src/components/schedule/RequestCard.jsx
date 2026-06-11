import { format, parseISO } from 'date-fns';
import { Calendar, CheckCircle, Eye, EyeOff, XCircle, Users, Moon, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import ScheduleGrid from '@/components/schedule/ScheduleGrid';
import ScheduleAnalytics from '@/components/schedule/ScheduleAnalytics';
import { buildScheduleSummary } from '@/components/schedule/scheduleUtils';

const statusLabels = {
  pending_hr_review: 'Pending HR Review',
  approved: 'Approved',
  rejected: 'Rejected',
};
const statusBadge = {
  pending_hr_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function RequestCard({ request, shiftTemplates, expanded, onToggle, selected, onSelect, onApprove, onReject, busy }) {
  const summary = buildScheduleSummary({
    employees: request.employees || [],
    assignments: request.assignments || {},
    periodStart: request.period_start,
    periodEnd: request.period_end,
    shiftTemplates,
  });
  const isPending = request.status === 'pending_hr_review';

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 p-4">
        <div className="flex gap-3">
          {isPending && (
            <Checkbox checked={selected} onCheckedChange={() => onSelect(request.id)} className="mt-1" />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base">{request.team_name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusBadge[request.status] || 'bg-slate-100 text-slate-600'}`}>{statusLabels[request.status] || request.status}</span>
            </div>
            <p className="text-sm text-slate-600 mt-1">{request.company_name || 'Company'} {request.branch_name ? `/ ${request.branch_name}` : ''} {request.department_name ? `/ ${request.department_name}` : ''}</p>
            <p className="text-sm text-slate-700 mt-1 flex items-center gap-1"><Calendar className="w-4 h-4" /> {request.period_start ? format(parseISO(request.period_start), 'MMM d') : '—'} - {request.period_end ? format(parseISO(request.period_end), 'd, yyyy') : '—'}</p>
            <p className="text-xs text-slate-500 mt-1">Leader: {request.leader_name || '—'} {request.leader_email ? `· ${request.leader_email}` : ''}</p>

            {/* Inline preview stats */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium"><Users className="w-3 h-3" /> {summary.employeeCount} staff</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">~{summary.avgDailyManpower.toFixed(1)} avg/day on duty</span>
              {summary.totalWfh > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-600 text-[11px] font-medium"><Moon className="w-3 h-3" /> {summary.totalWfh} WFH</span>}
              {summary.noDayOffDays.length > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[11px] font-medium"><AlertTriangle className="w-3 h-3" /> {summary.noDayOffDays.length} no-day-off</span>}
              {summary.criticalDays.length > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-600 text-[11px] font-medium"><AlertTriangle className="w-3 h-3" /> {summary.criticalDays.length} missing opener/closer</span>}
            </div>
            {request.status === 'rejected' && request.notes && (
              <p className="text-xs text-red-600 mt-2">Reason: {request.notes}</p>
            )}
          </div>
        </div>
        <div className="flex lg:flex-col gap-2 min-w-[150px]">
          <Button type="button" variant="secondary" size="sm" onClick={onToggle}>
            {expanded ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />} {expanded ? 'Hide' : 'View'}
          </Button>
          <Button type="button" size="sm" className="bg-green-500 hover:bg-green-600" disabled={busy || request.status === 'approved'} onClick={() => onApprove(request)}>
            <CheckCircle className="w-4 h-4 mr-1" /> Approve
          </Button>
          <Button type="button" size="sm" className="bg-red-500 hover:bg-red-600" disabled={busy || request.status === 'rejected'} onClick={() => onReject(request)}>
            <XCircle className="w-4 h-4 mr-1" /> Reject
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 p-5 space-y-5">
          <ScheduleGrid
            employees={request.employees || []}
            assignments={request.assignments || {}}
            periodStart={request.period_start}
            periodEnd={request.period_end}
            shiftTemplates={shiftTemplates}
          />
          <ScheduleAnalytics summary={summary} />
        </div>
      )}
    </div>
  );
}
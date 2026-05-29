import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { leaveTypeToScheduleType } from './scheduleUtils';

// Match a LeaveRequest to a selected employee (Airtable record) by name.
const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Build an overlay map { employeeId: { 'yyyy-MM-dd': scheduleType } } plus a notices list.
 * employees: selected employees [{ id, name }]
 * leaves: LeaveRequest records (already filtered by date range / status as needed)
 * localEmployees: local Employee entity records (to resolve leave.employee_id -> name)
 */
export const buildLeaveOverlay = ({ employees, leaves, localEmployees, periodStart, periodEnd }) => {
  const overlay = {};
  const notices = [];
  if (!employees?.length || !leaves?.length) return { overlay, notices };

  const localNameById = (localEmployees || []).reduce((m, e) => {
    m[e.id] = normalize(`${e.first_name || ''} ${e.last_name || ''}`);
    return m;
  }, {});

  const periodStartDate = parseISO(periodStart);
  const periodEndDate = parseISO(periodEnd);

  leaves.forEach(leave => {
    const leaveName = localNameById[leave.employee_id] || normalize(leave.employee_id);
    const match = employees.find(emp => normalize(emp.name) === leaveName);
    if (!match) return;

    const sched = leaveTypeToScheduleType(leave.leave_type, leave.is_paid);
    let from = parseISO(leave.date_from);
    let to = parseISO(leave.date_to);
    if (from < periodStartDate) from = periodStartDate;
    if (to > periodEndDate) to = periodEndDate;
    if (from > to) return;

    const days = eachDayOfInterval({ start: from, end: to });
    overlay[match.id] = overlay[match.id] || {};
    days.forEach(d => { overlay[match.id][format(d, 'yyyy-MM-dd')] = sched; });

    notices.push({
      employeeName: match.name,
      leaveType: leave.leave_type,
      isPaid: leave.is_paid,
      status: leave.status,
      from: leave.date_from,
      to: leave.date_to,
    });
  });

  return { overlay, notices };
};
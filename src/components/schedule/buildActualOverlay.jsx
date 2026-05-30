import { format } from 'date-fns';
import { getScheduleDays } from './scheduleUtils';

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Build { employeeId: { 'yyyy-MM-dd': { worked, hours, absent } } } overlaying
 * actual attendance punches against the plotted schedule.
 * employees: [{ id, name, ... }] (Airtable records, id = airtable_record_id)
 * logs: AttendanceLog records for the range
 * localEmployees: local Employee records (to resolve log keys -> name)
 * assignments: plotted schedule map { empId: { date: type } } to detect "scheduled work but no punch" = absent
 */
export const buildActualOverlay = ({ employees, logs, localEmployees, assignments, periodStart, periodEnd }) => {
  const overlay = {};
  if (!employees?.length) return overlay;

  const days = getScheduleDays(periodStart, periodEnd).map(d => format(d, 'yyyy-MM-dd'));
  const WORK_TYPES = new Set(['opener', 'closer', 'wfh']);

  // Resolve a log to an employee id via biometric/code/name
  const localById = (localEmployees || []).reduce((m, e) => {
    m[e.id] = normName(`${e.first_name || ''} ${e.middle_name || ''} ${e.last_name || ''}`);
    return m;
  }, {});

  // Index logs by employee match key
  const logsByEmp = {};
  logs.forEach(log => {
    const logName = normName(log.employee_name);
    const match = employees.find(emp =>
      emp.id === log.employee_id ||
      normName(emp.name) === logName ||
      normalize(emp.name) === normalize(log.employee_name)
    );
    if (!match) return;
    logsByEmp[match.id] = logsByEmp[match.id] || {};
    let worked = 0;
    if (log.time_in && log.time_out) {
      worked = (new Date(log.time_out) - new Date(log.time_in)) / 3600000;
      if (!Number.isFinite(worked) || worked <= 0) worked = Number(log.total_hours) || 0;
    }
    if (worked > 0) logsByEmp[match.id][log.date] = Math.min(worked, 12);
  });

  employees.forEach(emp => {
    overlay[emp.id] = {};
    days.forEach(date => {
      const hours = logsByEmp[emp.id]?.[date];
      const schedType = assignments?.[emp.id]?.[date];
      if (hours) {
        overlay[emp.id][date] = { worked: true, hours, absent: false };
      } else if (WORK_TYPES.has(schedType)) {
        overlay[emp.id][date] = { worked: false, hours: 0, absent: true };
      }
    });
  });

  return overlay;
};
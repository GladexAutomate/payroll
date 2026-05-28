import { eachDayOfInterval, format, getDaysInMonth, parseISO } from 'date-fns';

export const SCHEDULE_TYPES = {
  opener: { label: 'Opener\nOnsite', short: 'Opener', className: 'bg-blue-500 text-white border-blue-600' },
  closer: { label: 'Closer\nOnsite', short: 'Closer', className: 'bg-orange-500 text-white border-orange-600' },
  off: { label: 'OFF', short: 'OFF', className: 'bg-red-500 text-white border-red-600' },
  wfh: { label: 'WFH', short: 'WFH', className: 'bg-purple-500 text-white border-purple-600' },
  paid_vl: { label: 'Paid\nVL', short: 'Paid VL', className: 'bg-emerald-500 text-white border-emerald-600' },
  none: { label: 'No\nSched', short: 'No Sched', className: 'bg-slate-200 text-slate-700 border-slate-300' },
};

export const COST_COUNTED_TYPES = new Set(['opener', 'closer', 'wfh', 'paid_vl']);
export const MANPOWER_TYPES = new Set(['opener', 'closer', 'wfh']);
export const OFF_TYPES = new Set(['off', 'paid_vl']);

export const getEmployeeName = (record) => {
  const fields = record?.fields || record || {};
  return fields['Full Name'] || [fields['First Name'], fields['Last Name']].filter(Boolean).join(' ') || fields['Employee Code ID'] || record?.id || 'Employee';
};

export const getEmployeeSalary = (record) => {
  const fields = record?.fields || record || {};
  const raw = fields['monthly salary'] ?? fields['Monthly Salary'] ?? fields['MONTHLY SALARY'] ?? fields.monthly_salary ?? 0;
  return Number(String(raw).replace(/[^0-9.-]/g, '')) || 0;
};

export const getScheduleDays = (start, end) => {
  if (!start || !end) return [];
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
};

export const getMonthlyWorkDays = (dateValue) => {
  const date = parseISO(dateValue);
  const daysInMonth = getDaysInMonth(date);
  const requiredDaysOff = Math.floor(daysInMonth / 7);
  return Math.max(1, daysInMonth - requiredDaysOff);
};

export const buildScheduleSummary = ({ employees, assignments, periodStart, periodEnd }) => {
  const days = getScheduleDays(periodStart, periodEnd);
  const employeeCount = employees.length;
  const dailyRows = days.map(day => {
    const date = format(day, 'yyyy-MM-dd');
    let onDuty = 0;
    let offVl = 0;
    let wfh = 0;
    let dailyCost = 0;
    let hasOpener = false;
    let hasCloser = false;

    employees.forEach(emp => {
      const type = assignments?.[emp.id]?.[date] || 'none';
      const dailyRate = (Number(emp.monthly_salary) || 0) / getMonthlyWorkDays(date);
      if (MANPOWER_TYPES.has(type)) onDuty += 1;
      if (OFF_TYPES.has(type)) offVl += 1;
      if (type === 'wfh') wfh += 1;
      if (type === 'opener') hasOpener = true;
      if (type === 'closer') hasCloser = true;
      if (COST_COUNTED_TYPES.has(type)) dailyCost += dailyRate;
    });

    const status = onDuty === 0 ? 'Low Manpower' : offVl === 0 ? 'No Day-Off' : (!hasOpener || !hasCloser) ? 'No Opener/Closer' : 'OK';
    return { date, day: format(day, 'EEE'), onDuty, employeeCount, offVl, wfh, dailyCost, status, hasOpener, hasCloser };
  });

  const totalCost = dailyRows.reduce((sum, row) => sum + row.dailyCost, 0);
  const totalOffVl = dailyRows.reduce((sum, row) => sum + row.offVl, 0);
  const totalWfh = dailyRows.reduce((sum, row) => sum + row.wfh, 0);
  const avgDailyManpower = dailyRows.length ? dailyRows.reduce((sum, row) => sum + row.onDuty, 0) / dailyRows.length : 0;
  const noDayOffDays = dailyRows.filter(row => row.offVl === 0);
  const criticalDays = dailyRows.filter(row => !row.hasOpener || !row.hasCloser);
  const lowest = dailyRows.reduce((min, row) => !min || row.onDuty < min.onDuty ? row : min, null);
  const highest = dailyRows.reduce((max, row) => !max || row.onDuty > max.onDuty ? row : max, null);

  return { employeeCount, totalCost, totalOffVl, totalWfh, avgDailyManpower, dailyRows, noDayOffDays, criticalDays, lowest, highest };
};

export const peso = (value) => `₱${Math.round(Number(value) || 0).toLocaleString()}`;
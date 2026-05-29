import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { SCHEDULE_TYPES, getScheduleDays } from './scheduleUtils';

// Build a label for a cell value (supports shift:<id> keys)
const cellLabel = (type, shiftTemplates) => {
  if (!type || type === 'none') return '';
  if (type.startsWith('shift:')) {
    const t = shiftTemplates.find(s => `shift:${s.id}` === type);
    return t ? `${t.name} (${t.start_time}-${t.end_time})` : 'Shift';
  }
  return SCHEDULE_TYPES[type]?.short || type;
};

export const exportApprovedScheduleToExcel = ({ employees, assignments, shiftTemplates, periodStart, periodEnd }) => {
  const days = getScheduleDays(periodStart, periodEnd);
  const dateCols = days.map(d => format(d, 'MM-dd (EEE)'));

  const rows = employees.map(emp => {
    const row = { Employee: emp.name, Department: emp.department || '' };
    days.forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      row[format(d, 'MM-dd (EEE)')] = cellLabel(assignments?.[emp.id]?.[key], shiftTemplates);
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: ['Employee', 'Department', ...dateCols] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Approved Schedule');
  XLSX.writeFile(wb, `approved-schedule-${periodStart}-to-${periodEnd}.xlsx`);
};
import { useState } from 'react';
import { format } from 'date-fns';
import { SCHEDULE_TYPES, getScheduleDays } from './scheduleUtils';
import CellFillMenu from './CellFillMenu';

const DEFAULT_CYCLE = ['opener', 'closer', 'off', 'wfh', 'paid_vl', 'sick', 'unpaid_vl', 'emergency', 'maternity', 'paternity', 'none'];

// resolve a card config — supports built-in keys and dynamic shift cards (shift:<id>)
const resolveConfig = (type, shiftCards = {}) => {
  if (type && type.startsWith('shift:')) {
    return shiftCards[type] || { label: 'Shift', short: 'Shift', className: 'bg-indigo-500 text-white border-indigo-600' };
  }
  return SCHEDULE_TYPES[type] || SCHEDULE_TYPES.none;
};

export default function ScheduleGrid({ employees, assignments, periodStart, periodEnd, editable = false, onChange, onFill, shiftTemplates = [], leaveOverlay = {} }) {
  const days = getScheduleDays(periodStart, periodEnd);
  const [menuCell, setMenuCell] = useState(null); // { employeeId, date, type }
  const [dragOver, setDragOver] = useState(null);

  // Build dynamic shift cards from templates
  const shiftCards = {};
  const shiftKeys = shiftTemplates.map(t => {
    const key = `shift:${t.id}`;
    shiftCards[key] = {
      label: (t.name || 'Shift').slice(0, 10),
      short: `${t.name} (${t.start_time}-${t.end_time})`,
      className: 'bg-indigo-500 text-white border-indigo-600',
    };
    return key;
  });

  const cycle = [...DEFAULT_CYCLE.slice(0, 10), ...shiftKeys, 'none'];

  const cycleType = (employeeId, date) => {
    if (!editable) return;
    const current = assignments?.[employeeId]?.[date] || 'none';
    const idx = cycle.indexOf(current);
    const next = cycle[(idx + 1) % cycle.length];
    onChange(employeeId, date, next);
  };

  const handleDrop = (e, employeeId, date) => {
    if (!editable) return;
    e.preventDefault();
    setDragOver(null);
    const card = e.dataTransfer.getData('text/schedule-card');
    if (!card) return;
    onChange(employeeId, date, card);
    setMenuCell({ employeeId, date, type: card });
  };

  const handleFill = (direction) => {
    if (menuCell && onFill) onFill(menuCell.employeeId, menuCell.date, menuCell.type, direction);
    setMenuCell(null);
  };

  const handleDelete = () => {
    if (menuCell) onChange(menuCell.employeeId, menuCell.date, 'none');
    setMenuCell(null);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-xs min-w-full">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th className="sticky left-0 z-20 bg-blue-900 text-left py-2.5 px-3 min-w-[170px]">Employee</th>
              {days.map(day => (
                <th key={day.toISOString()} className="py-2 px-2 text-center min-w-[62px]">
                  <div className="font-semibold">{format(day, 'MM-dd')}</div>
                  <div className="text-[10px] opacity-80">{format(day, 'EEE')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b border-border/60">
                <td className="sticky left-0 z-10 bg-card py-2 px-3 font-semibold text-[11px] border-r border-border uppercase whitespace-nowrap">
                  {emp.name}
                </td>
                {days.map(day => {
                  const date = format(day, 'yyyy-MM-dd');
                  const pendingLeave = leaveOverlay?.[emp.id]?.[date];
                  // Pending leaves are NOT plotted — only show a pulsing hint on a blank cell.
                  const type = assignments?.[emp.id]?.[date] || 'none';
                  const config = resolveConfig(type, shiftCards);
                  const isPendingLeave = !assignments?.[emp.id]?.[date] && pendingLeave;
                  const pendingConfig = isPendingLeave ? resolveConfig(pendingLeave, shiftCards) : null;
                  const cellKey = `${emp.id}|${date}`;
                  const isDragOver = dragOver === cellKey;
                  const showMenu = menuCell && menuCell.employeeId === emp.id && menuCell.date === date;
                  return (
                    <td key={date} className="relative p-1 text-center border-r border-border/30">
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => cycleType(emp.id, date)}
                        onDragOver={editable ? (e) => { e.preventDefault(); setDragOver(cellKey); } : undefined}
                        onDragLeave={editable ? () => setDragOver(prev => prev === cellKey ? null : prev) : undefined}
                        onDrop={editable ? (e) => handleDrop(e, emp.id, date) : undefined}
                        className={`relative w-[58px] min-h-[34px] rounded border px-1 py-1 text-[10px] font-bold leading-tight whitespace-pre-line ${config.className} ${editable ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-default'} ${isDragOver ? 'ring-2 ring-primary scale-110' : ''}`}
                        title={isPendingLeave ? `Pending leave request: ${pendingConfig?.short}` : editable ? 'Click to cycle, or drag a card here' : config.short}
                      >
                        {isPendingLeave && (
                          <span className="pointer-events-none absolute inset-0 rounded ring-2 ring-yellow-400/70 bg-yellow-300/20 animate-pulse" />
                        )}
                        <span className="relative">{config.label}</span>
                      </button>
                      {showMenu && (
                        <CellFillMenu onFill={handleFill} onDelete={handleDelete} onClose={() => setMenuCell(null)} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
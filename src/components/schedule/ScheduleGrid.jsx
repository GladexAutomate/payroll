import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { SCHEDULE_TYPES, getScheduleDays } from './scheduleUtils';

// resolve a card config — supports built-in keys and dynamic shift cards (shift:<id>)
const resolveConfig = (type, shiftCards = {}) => {
  if (type && type.startsWith('shift:')) {
    return shiftCards[type] || { label: 'Shift', short: 'Shift', className: 'bg-indigo-500 text-white border-indigo-600' };
  }
  return SCHEDULE_TYPES[type] || SCHEDULE_TYPES.none;
};

export default function ScheduleGrid({ employees, assignments, periodStart, periodEnd, editable = false, onChange, onFill, shiftTemplates = [], leaveOverlay = {}, actualOverlay = null }) {
  const days = getScheduleDays(periodStart, periodEnd);
  const [menuCell, setMenuCell] = useState(null); // { employeeId, date, type }
  const [dragOver, setDragOver] = useState(null);

  // Build dynamic shift cards from templates — color comes from the template
  const shiftCards = {};
  shiftTemplates.forEach(t => {
    shiftCards[`shift:${t.id}`] = {
      label: (t.name || 'Shift').slice(0, 10),
      short: `${t.name} (${t.start_time}-${t.end_time})`,
      className: 'text-white',
      color: t.card_color || '#6366f1',
    };
  });

  const openMenu = (employeeId, date, type) => {
    if (!editable || type === 'none') return;
    setMenuCell(prev => (prev && prev.employeeId === employeeId && prev.date === date) ? null : { employeeId, date, type });
  };

  const handleDrop = (e, employeeId, date) => {
    if (!editable) return;
    e.preventDefault();
    setDragOver(null);
    const card = e.dataTransfer.getData('text/schedule-card');
    if (!card) return;
    onChange(employeeId, date, card);
    setMenuCell(null);
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
                        onClick={() => openMenu(emp.id, date, type)}
                        onDragOver={editable ? (e) => { e.preventDefault(); setDragOver(cellKey); } : undefined}
                        onDragLeave={editable ? () => setDragOver(prev => prev === cellKey ? null : prev) : undefined}
                        onDrop={editable ? (e) => handleDrop(e, emp.id, date) : undefined}
                        style={config.color ? { backgroundColor: config.color, borderColor: config.color } : undefined}
                        className={`relative w-[58px] min-h-[34px] rounded border px-1 py-1 text-[10px] font-bold leading-tight whitespace-pre-line ${config.className} ${editable ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-default'} ${isDragOver ? 'ring-2 ring-primary scale-110' : ''} ${showMenu ? 'ring-2 ring-primary' : ''}`}
                        title={isPendingLeave ? `Pending leave request: ${pendingConfig?.short}` : editable ? (type === 'none' ? 'Drag a card here' : 'Click to fill / delete') : config.short}
                      >
                        {isPendingLeave && (
                          <span className="pointer-events-none absolute inset-0 rounded ring-2 ring-yellow-400/70 bg-yellow-300/20 animate-pulse" />
                        )}
                        <span className="relative">{config.label}</span>
                      </button>
                      {showMenu && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setMenuCell(null)} />
                          {/* Up */}
                          <button type="button" onClick={() => handleFill('up')} title="Fill up"
                            className="absolute z-40 left-1/2 -translate-x-1/2 top-[-10px] w-5 h-5 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center hover:scale-110 transition">
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          {/* Down */}
                          <button type="button" onClick={() => handleFill('down')} title="Fill down"
                            className="absolute z-40 left-1/2 -translate-x-1/2 bottom-[-10px] w-5 h-5 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center hover:scale-110 transition">
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          {/* Left */}
                          <button type="button" onClick={() => handleFill('left')} title="Fill left"
                            className="absolute z-40 top-1/2 -translate-y-1/2 left-[-10px] w-5 h-5 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center hover:scale-110 transition">
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          {/* Right */}
                          <button type="button" onClick={() => handleFill('right')} title="Fill right"
                            className="absolute z-40 top-1/2 -translate-y-1/2 right-[-10px] w-5 h-5 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center hover:scale-110 transition">
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          {/* Delete */}
                          <button type="button" onClick={handleDelete} title="Delete"
                            className="absolute z-40 top-[-10px] right-[-6px] w-5 h-5 rounded-full bg-destructive text-destructive-foreground shadow flex items-center justify-center hover:scale-110 transition">
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      {actualOverlay && (() => {
                        const a = actualOverlay?.[emp.id]?.[date];
                        if (!a) return null;
                        if (a.worked) {
                          return <div className="mt-0.5 text-[9px] font-bold text-green-700">✓ {Number(a.hours).toFixed(1)}h</div>;
                        }
                        if (a.absent) {
                          return <div className="mt-0.5 text-[9px] font-bold text-red-600">✗ Absent</div>;
                        }
                        return null;
                      })()}
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
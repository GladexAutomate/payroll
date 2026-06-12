import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X, Settings2, Pencil } from 'lucide-react';
import { SCHEDULE_TYPES, getScheduleDays, parseShiftValue } from './scheduleUtils';
import ShiftCellOptions from './ShiftCellOptions';
import { fmtClock } from '@/lib/dateFormat';

const fmtCustom = (c) => {
  if (!c || !c.includes('-')) return c;
  return c.split('-').map(p => fmtClock(p.length === 4 ? `${p.slice(0, 2)}:${p.slice(2)}` : p, p)).join('-');
};

// resolve a card config — supports built-in keys and dynamic shift cards (shift:<id> + ::wfh / ::custom)
const resolveConfig = (type, shiftCards = {}) => {
  if (type && type.startsWith('shift:')) {
    const { baseType, mode, custom } = parseShiftValue(type);
    const base = shiftCards[baseType] || { label: 'Shift', short: 'Shift', className: 'bg-indigo-500 text-white border-indigo-600' };
    if (mode === 'wfh') {
      return { ...base, label: `${base.label}\nWFH`, short: `${base.short} · WFH`, color: '#8b5cf6' };
    }
    if (mode === 'custom') {
      return { ...base, label: `${base.label}\n${fmtCustom(custom)}`, short: `${base.short} · ${fmtCustom(custom)}`, color: '#f59e0b' };
    }
    return base;
  }
  return SCHEDULE_TYPES[type] || SCHEDULE_TYPES.none;
};

export default function ScheduleGrid({ employees, assignments, periodStart, periodEnd, editable = false, onChange, onFill, onFillTo, onEditEmployee, shiftTemplates = [], leaveOverlay = {}, actualOverlay = null }) {
  const days = getScheduleDays(periodStart, periodEnd);
  const dayKeys = days.map(d => format(d, 'yyyy-MM-dd'));
  const [menuCell, setMenuCell] = useState(null); // { employeeId, date, type }
  const [optionsCell, setOptionsCell] = useState(null); // { employeeId, date, type }
  const [dragOver, setDragOver] = useState(null);
  // Drag-to-fill: drag an arrow and the fill follows the cursor along its axis
  const [fillDrag, setFillDrag] = useState(null); // { employeeId, date, type, axis, target: {employeeId,date} }

  // Compute which cells are currently inside the drag-fill preview
  const previewSet = (() => {
    if (!fillDrag || !fillDrag.target) return null;
    const set = new Set();
    const { axis, employeeId, date, target } = fillDrag;
    if (axis === 'horizontal') {
      const from = dayKeys.indexOf(date);
      const to = dayKeys.indexOf(target.date);
      if (from === -1 || to === -1) return set;
      const [a, b] = from <= to ? [from, to] : [to, from];
      for (let i = a; i <= b; i++) set.add(`${employeeId}|${dayKeys[i]}`);
    } else {
      const from = employees.findIndex(e => e.id === employeeId);
      const to = employees.findIndex(e => e.id === target.employeeId);
      if (from === -1 || to === -1) return set;
      const [a, b] = from <= to ? [from, to] : [to, from];
      for (let i = a; i <= b; i++) set.add(`${employees[i].id}|${date}`);
    }
    return set;
  })();

  // Commit the drag-fill on mouse up anywhere
  useEffect(() => {
    if (!fillDrag) return;
    const finish = () => {
      setFillDrag(curr => {
        if (curr && curr.moved && curr.target && onFillTo) {
          onFillTo(curr.employeeId, curr.date, curr.type, curr.axis, curr.target);
          setMenuCell(null);
        }
        return null;
      });
    };
    window.addEventListener('mouseup', finish);
    return () => window.removeEventListener('mouseup', finish);
  }, [fillDrag, onFillTo]);

  const startFillDrag = (employeeId, date, type, axis) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFillDrag({ employeeId, date, type, axis, target: { employeeId, date } });
  };

  const onCellEnter = (employeeId, date) => {
    if (!fillDrag) return;
    setFillDrag(curr => {
      if (!curr) return curr;
      const moved = curr.moved || employeeId !== curr.employeeId || date !== curr.date;
      return { ...curr, moved, target: { employeeId, date } };
    });
  };

  // If the user dragged across cells, suppress the arrow's onClick fallback
  const suppressClick = (handler) => (e) => {
    if (fillDrag && fillDrag.moved) { e.preventDefault(); e.stopPropagation(); return; }
    handler();
  };

  // Build dynamic shift cards from templates — color comes from the template
  const shiftCards = {};
  shiftTemplates.forEach(t => {
    shiftCards[`shift:${t.id}`] = {
      label: (t.name || 'Shift').slice(0, 10),
      short: `${t.name} (${fmtClock(t.start_time)}-${fmtClock(t.end_time)})`,
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
                <th key={day.toISOString()} className="py-2 px-2 text-center min-w-[76px]">
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
                  <div className="flex items-center gap-1.5">
                    {onEditEmployee && (
                      <button
                        type="button"
                        onClick={() => onEditEmployee(emp)}
                        className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary normal-case"
                        title="Edit this employee's schedule"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    <span>{emp.name}</span>
                  </div>
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
                  const isPreview = previewSet?.has(cellKey);
                  const showMenu = menuCell && menuCell.employeeId === emp.id && menuCell.date === date;
                  return (
                    <td key={date} className="relative p-1 text-center border-r border-border/30 min-w-[76px]"
                      onMouseEnter={editable ? () => onCellEnter(emp.id, date) : undefined}>
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => openMenu(emp.id, date, type)}
                        onDragOver={editable ? (e) => { e.preventDefault(); setDragOver(cellKey); } : undefined}
                        onDragLeave={editable ? () => setDragOver(prev => prev === cellKey ? null : prev) : undefined}
                        onDrop={editable ? (e) => handleDrop(e, emp.id, date) : undefined}
                        style={config.color ? { backgroundColor: config.color, borderColor: config.color } : undefined}
                        className={`relative w-[68px] min-h-[40px] rounded border px-1.5 py-1 text-[10px] font-bold leading-tight whitespace-pre-line ${config.className} ${editable ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-default'} ${fillDrag ? 'pointer-events-none' : ''} ${isDragOver ? 'ring-2 ring-primary scale-110' : ''} ${showMenu ? 'ring-2 ring-primary' : ''}`}
                        title={isPendingLeave ? `Pending leave request: ${pendingConfig?.short}` : editable ? (type === 'none' ? 'Drag a card here' : 'Click to fill / delete') : config.short}
                      >
                        {isPendingLeave && (
                          <span className="pointer-events-none absolute inset-0 rounded ring-2 ring-yellow-400/70 bg-yellow-300/20 animate-pulse" />
                        )}
                        <span className="relative">{config.label}</span>
                      </button>
                      {isPreview && (
                        <span className="pointer-events-none absolute inset-1 rounded ring-2 ring-primary bg-primary/30 z-20" />
                      )}
                      {showMenu && (
                        <>
                          <div className={`fixed inset-0 z-30 ${fillDrag ? 'pointer-events-none' : ''}`} onClick={() => setMenuCell(null)} />
                          {/* Up (vertical drag) */}
                          <button type="button" onMouseDown={startFillDrag(emp.id, date, type, 'vertical')} onClick={suppressClick(() => handleFill('up'))} title="Drag to fill up"
                            className="absolute z-40 left-1/2 -translate-x-1/2 top-[-10px] w-5 h-5 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center hover:scale-110 transition cursor-grab active:cursor-grabbing">
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          {/* Down (vertical drag) */}
                          <button type="button" onMouseDown={startFillDrag(emp.id, date, type, 'vertical')} onClick={suppressClick(() => handleFill('down'))} title="Drag to fill down"
                            className="absolute z-40 left-1/2 -translate-x-1/2 bottom-[-10px] w-5 h-5 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center hover:scale-110 transition cursor-grab active:cursor-grabbing">
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          {/* Left (horizontal drag) */}
                          <button type="button" onMouseDown={startFillDrag(emp.id, date, type, 'horizontal')} onClick={suppressClick(() => handleFill('left'))} title="Drag to fill left"
                            className="absolute z-40 top-1/2 -translate-y-1/2 left-[-10px] w-5 h-5 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center hover:scale-110 transition cursor-grab active:cursor-grabbing">
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          {/* Right (horizontal drag) */}
                          <button type="button" onMouseDown={startFillDrag(emp.id, date, type, 'horizontal')} onClick={suppressClick(() => handleFill('right'))} title="Drag to fill right"
                            className="absolute z-40 top-1/2 -translate-y-1/2 right-[-10px] w-5 h-5 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center hover:scale-110 transition cursor-grab active:cursor-grabbing">
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          {/* Options (WFH / custom time) — only for shift cards */}
                          {type.startsWith('shift:') && (
                            <button type="button" onClick={() => { setOptionsCell({ employeeId: emp.id, date, type }); setMenuCell(null); }} title="WFH / Custom time"
                              className="absolute z-40 top-[-10px] left-[-6px] w-5 h-5 rounded-full bg-amber-500 text-white shadow flex items-center justify-center hover:scale-110 transition">
                              <Settings2 className="w-3 h-3" />
                            </button>
                          )}
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
      {optionsCell && (
        <ShiftCellOptions
          open={!!optionsCell}
          onClose={() => setOptionsCell(null)}
          value={optionsCell.type}
          shiftName={(shiftCards[parseShiftValue(optionsCell.type).baseType] || {}).short || 'Shift'}
          onApply={(newValue) => onChange(optionsCell.employeeId, optionsCell.date, newValue)}
        />
      )}
    </div>
  );
}
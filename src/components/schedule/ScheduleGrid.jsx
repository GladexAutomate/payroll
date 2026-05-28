import { format } from 'date-fns';
import { SCHEDULE_TYPES, getScheduleDays } from './scheduleUtils';

export default function ScheduleGrid({ employees, assignments, periodStart, periodEnd, editable = false, onChange }) {
  const days = getScheduleDays(periodStart, periodEnd);
  const typeKeys = ['opener', 'closer', 'off', 'wfh', 'paid_vl', 'none'];

  const cycleType = (employeeId, date) => {
    if (!editable) return;
    const current = assignments?.[employeeId]?.[date] || 'none';
    const next = typeKeys[(typeKeys.indexOf(current) + 1) % typeKeys.length];
    onChange(employeeId, date, next);
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
                  const type = assignments?.[emp.id]?.[date] || 'none';
                  const config = SCHEDULE_TYPES[type] || SCHEDULE_TYPES.none;
                  return (
                    <td key={date} className="p-1 text-center border-r border-border/30">
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => cycleType(emp.id, date)}
                        className={`w-[58px] min-h-[34px] rounded border px-1 py-1 text-[10px] font-bold leading-tight whitespace-pre-line ${config.className} ${editable ? 'cursor-pointer hover:scale-105 transition-transform' : 'cursor-default'}`}
                        title={editable ? 'Click to change schedule card' : config.short}
                      >
                        {config.label}
                      </button>
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
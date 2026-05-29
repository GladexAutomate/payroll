import { SCHEDULE_TYPES } from './scheduleUtils';

const ORDER = ['opener', 'closer', 'off', 'wfh', 'paid_vl', 'sick', 'unpaid_vl', 'emergency', 'maternity', 'paternity', 'none'];

export default function ScheduleLegend({ shiftTemplates = [] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {ORDER.map(key => {
        const c = SCHEDULE_TYPES[key];
        return (
          <span key={key} className={`px-2 py-0.5 rounded border font-semibold ${c.className}`}>
            {c.short}
          </span>
        );
      })}
      {shiftTemplates.map(t => (
        <span key={t.id} className="px-2 py-0.5 rounded border font-semibold bg-indigo-500 text-white border-indigo-600">
          {t.name} ({t.start_time}-{t.end_time})
        </span>
      ))}
    </div>
  );
}
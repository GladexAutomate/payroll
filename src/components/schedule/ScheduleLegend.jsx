import { SCHEDULE_TYPES } from './scheduleUtils';
import { fmtClock } from '@/lib/dateFormat';

const ORDER = ['off', 'paid_vl', 'sick', 'unpaid_vl', 'emergency', 'maternity', 'paternity', 'none'];

export default function ScheduleLegend({ shiftTemplates = [], draggable = false }) {
  const onDragStart = (e, key) => {
    e.dataTransfer.setData('text/schedule-card', key);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {shiftTemplates.map(t => (
        <span
          key={t.id}
          draggable={draggable}
          onDragStart={draggable ? (e) => onDragStart(e, `shift:${t.id}`) : undefined}
          style={{ backgroundColor: t.card_color || '#6366f1', borderColor: t.card_color || '#6366f1' }}
          className={`px-2 py-0.5 rounded border font-semibold text-white ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          {t.name} ({fmtClock(t.start_time)}-{fmtClock(t.end_time)})
        </span>
      ))}
      {ORDER.map(key => {
        const c = SCHEDULE_TYPES[key];
        return (
          <span
            key={key}
            draggable={draggable}
            onDragStart={draggable ? (e) => onDragStart(e, key) : undefined}
            className={`px-2 py-0.5 rounded border font-semibold ${c.className} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            {c.short}
          </span>
        );
      })}
    </div>
  );
}
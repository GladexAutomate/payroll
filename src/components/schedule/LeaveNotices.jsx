import { AlertTriangle } from 'lucide-react';
import { SCHEDULE_TYPES, leaveTypeToScheduleType } from './scheduleUtils';

export default function LeaveNotices({ notices = [] }) {
  if (!notices.length) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <p className="text-sm font-semibold text-amber-800">
          {notices.length} leave request(s) overlap this schedule — already plotted on the grid
        </p>
      </div>
      <ul className="space-y-1">
        {notices.map((n, i) => {
          const card = SCHEDULE_TYPES[leaveTypeToScheduleType(n.leaveType, n.isPaid)];
          return (
            <li key={i} className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
              <span className={`px-2 py-0.5 rounded border font-semibold ${card.className}`}>{card.short}</span>
              <span className="font-medium">{n.employeeName}</span>
              <span className="text-amber-700">{n.from} → {n.to}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${n.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {n.status === 'approved' ? 'Approved' : 'Pending'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
import { AlertTriangle, DollarSign, TrendingUp, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { peso } from './scheduleUtils';

const statusClass = {
  OK: 'bg-green-100 text-green-700',
  'No Day-Off': 'bg-red-100 text-red-700',
  'No Opener/Closer': 'bg-red-100 text-red-700',
  'Low Manpower': 'bg-orange-100 text-orange-700',
};

export default function ScheduleAnalytics({ summary }) {
  if (!summary) return null;

  const cards = [
    { label: 'Avg Daily Manpower', value: `${summary.avgDailyManpower.toFixed(1)} / ${summary.employeeCount}`, sub: 'employees on duty', icon: Users, className: 'bg-blue-50 border-blue-200 text-blue-900' },
    { label: 'Total Period Cost', value: peso(summary.totalCost), sub: `${peso(summary.dailyRows.length ? summary.totalCost / summary.dailyRows.length : 0)}/day`, icon: DollarSign, className: 'bg-green-50 border-green-200 text-green-900' },
    { label: 'Total OFF/VL Days', value: summary.totalOffVl, sub: `${summary.totalWfh} WFH days`, icon: TrendingUp, className: 'bg-orange-50 border-orange-200 text-orange-900' },
    { label: 'No Day-Off Days', value: summary.noDayOffDays.length, sub: 'days where no one is off', icon: AlertTriangle, className: 'bg-red-50 border-red-200 text-red-900' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wide">Manpower Analytics</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(card => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.className}`}>
            <div className="flex items-center gap-2 text-xs"><card.icon className="w-4 h-4" /> {card.label}</div>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
            <p className="text-xs opacity-70">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-3 bg-muted text-xs font-bold uppercase">Daily Breakdown</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Day</th>
                <th className="text-center px-4 py-2">On Duty</th>
                <th className="text-center px-4 py-2">OFF / VL</th>
                <th className="text-center px-4 py-2">WFH</th>
                <th className="text-center px-4 py-2">Daily Cost</th>
                <th className="text-center px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.dailyRows.map(row => (
                <tr key={row.date} className="border-b border-border/50 odd:bg-muted/25">
                  <td className="px-4 py-2 font-mono">{format(parseISO(row.date), 'MM-dd')}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.day}</td>
                  <td className="px-4 py-2 text-center"><span className="font-bold text-blue-600">{row.onDuty}</span> / {row.employeeCount}</td>
                  <td className={`px-4 py-2 text-center ${row.offVl === 0 ? 'text-red-600 font-semibold' : ''}`}>{row.offVl}</td>
                  <td className="px-4 py-2 text-center">{row.wfh}</td>
                  <td className="px-4 py-2 text-center font-bold text-green-700">{peso(row.dailyCost)}</td>
                  <td className="px-4 py-2 text-center"><span className={`px-2 py-1 rounded text-[11px] font-bold ${statusClass[row.status]}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {summary.criticalDays.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-bold">CRITICAL: {summary.criticalDays.length} day(s) with NO OPENER or CLOSER:</p>
          <p className="text-xs mt-1">{summary.criticalDays.map(row => `${format(parseISO(row.date), 'MM-dd')} (${row.day})`).join(', ')}</p>
        </div>
      )}
      {summary.noDayOffDays.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-bold">{summary.noDayOffDays.length} day(s) with no employee on OFF/VL:</p>
          <p className="text-xs mt-1">{summary.noDayOffDays.map(row => `${format(parseISO(row.date), 'MM-dd')} (${row.day})`).join(', ')}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-700">
          <p className="text-xs font-bold">Lowest Manpower Day</p>
          <p className="text-lg font-bold">{summary.lowest?.onDuty || 0} on duty</p>
          <p className="text-xs">{summary.lowest ? `${format(parseISO(summary.lowest.date), 'MM-dd')} (${summary.lowest.day}) · ${peso(summary.lowest.dailyCost)}` : '—'}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700">
          <p className="text-xs font-bold">Highest Manpower Day</p>
          <p className="text-lg font-bold">{summary.highest?.onDuty || 0} on duty</p>
          <p className="text-xs">{summary.highest ? `${format(parseISO(summary.highest.date), 'MM-dd')} (${summary.highest.day}) · ${peso(summary.highest.dailyCost)}` : '—'}</p>
        </div>
      </div>
    </div>
  );
}
import { endOfMonth, format } from 'date-fns';

// Build a list of semi-monthly cutoff periods (1st cut: 1-15, 2nd cut: 16-end)
// for a range of months around the current date.
export const buildPayPeriods = (monthsBack = 1, monthsForward = 6) => {
  const periods = [];
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let i = -monthsBack; i <= monthsForward; i++) {
    const monthStart = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const monthName = format(monthStart, 'MMM yyyy');

    const firstStart = format(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1), 'yyyy-MM-dd');
    const firstEnd = format(new Date(monthStart.getFullYear(), monthStart.getMonth(), 15), 'yyyy-MM-dd');
    periods.push({
      value: `${firstStart}|${firstEnd}`,
      label: `${monthName} — 1st Cut (1–15)`,
      period_start: firstStart,
      period_end: firstEnd,
    });

    const secondStart = format(new Date(monthStart.getFullYear(), monthStart.getMonth(), 16), 'yyyy-MM-dd');
    const secondEnd = format(endOfMonth(monthStart), 'yyyy-MM-dd');
    periods.push({
      value: `${secondStart}|${secondEnd}`,
      label: `${monthName} — 2nd Cut (16–${format(endOfMonth(monthStart), 'd')})`,
      period_start: secondStart,
      period_end: secondEnd,
    });
  }

  return periods;
};
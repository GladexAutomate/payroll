import { format, parseISO } from 'date-fns';

// Centralized date & time formatting helpers for the whole app.
// Dates always render like "Jun 1 2026" (no commas, no raw numbers like 2026-06-01).
// Times always render in 12-hour format with AM/PM (no military/24h time).

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  try {
    // Handle plain date strings (yyyy-MM-dd) and full ISO datetimes.
    const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseISO(`${value}T00:00:00`)
      : parseISO(String(value));
    return isNaN(d) ? null : d;
  } catch {
    return null;
  }
};

// "Jun 1 2026"
export const fmtDate = (value, fallback = '—') => {
  const d = toDate(value);
  return d ? format(d, 'MMM d yyyy') : fallback;
};

// "Jun 1 2026 3:45 PM"
export const fmtDateTime = (value, fallback = '—') => {
  const d = toDate(value);
  return d ? format(d, 'MMM d yyyy h:mm a') : fallback;
};

// "3:45 PM"
export const fmtTime = (value, fallback = '—') => {
  const d = toDate(value);
  return d ? format(d, 'h:mm a') : fallback;
};

// "Jun 1 2026 – Jun 15 2026"
export const fmtDateRange = (start, end) => {
  const s = fmtDate(start, '');
  const e = fmtDate(end, '');
  if (s && e) return `${s} – ${e}`;
  return s || e || '—';
};
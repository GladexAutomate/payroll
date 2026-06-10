import { format, parseISO } from 'date-fns';

export const peso = (n) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'MMM d, yyyy h:mm a'); } catch { return '—'; }
};

export const fmtDuration = (ms) => {
  const s = Math.round(Number(ms || 0) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};

export const RUN_STATUS = {
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700 border-green-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
};
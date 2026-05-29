import { endOfMonth, format, parse } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// Simple picker: choose a month, then click 1st Cut (1–15) or 2nd Cut (16–end).
export default function PayPeriodPicker({ periodStart, periodEnd, onChange }) {
  // Derive the selected month from the current period_start (fallback to current month)
  const month = periodStart ? periodStart.slice(0, 7) : format(new Date(), 'yyyy-MM');
  const cut = periodStart && Number(periodStart.slice(8, 10)) >= 16 ? 2 : 1;

  const applyCut = (m, which) => {
    const monthDate = parse(`${m}-01`, 'yyyy-MM-dd', new Date());
    if (which === 1) {
      onChange(
        format(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1), 'yyyy-MM-dd'),
        format(new Date(monthDate.getFullYear(), monthDate.getMonth(), 15), 'yyyy-MM-dd'),
      );
    } else {
      onChange(
        format(new Date(monthDate.getFullYear(), monthDate.getMonth(), 16), 'yyyy-MM-dd'),
        format(endOfMonth(monthDate), 'yyyy-MM-dd'),
      );
    }
  };

  return (
    <div className="md:col-span-2">
      <Label className="text-xs">Pay Period*</Label>
      <div className="mt-1 flex flex-col sm:flex-row gap-2">
        <Input
          type="month"
          value={month}
          onChange={e => applyCut(e.target.value, cut)}
          className="sm:w-44"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => applyCut(month, 1)}
            className={`flex-1 sm:flex-none px-4 h-9 rounded-md text-sm font-medium border transition-colors ${cut === 1 ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-input hover:bg-accent'}`}
          >
            1st Cut (1–15)
          </button>
          <button
            type="button"
            onClick={() => applyCut(month, 2)}
            className={`flex-1 sm:flex-none px-4 h-9 rounded-md text-sm font-medium border transition-colors ${cut === 2 ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-input hover:bg-accent'}`}
          >
            2nd Cut (16–end)
          </button>
        </div>
      </div>
      {periodStart && periodEnd && (
        <p className="text-[11px] text-muted-foreground mt-1">
          {format(parse(periodStart, 'yyyy-MM-dd', new Date()), 'MMM d')} – {format(parse(periodEnd, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}
        </p>
      )}
    </div>
  );
}
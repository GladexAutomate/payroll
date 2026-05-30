import { useState } from 'react';
import { Home, Clock, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseShiftValue, buildShiftValue } from './scheduleUtils';

// Modal to set a plotted shift cell as Onsite (normal), WFH, or a Custom time range.
export default function ShiftCellOptions({ open, onClose, value, shiftName, onApply }) {
  const { baseType, mode, custom } = parseShiftValue(value);
  const [start, setStart] = useState(custom ? custom.split('-')[0] : '');
  const [end, setEnd] = useState(custom ? custom.split('-')[1] : '');

  const apply = (newMode, newCustom) => {
    onApply(buildShiftValue(baseType, newMode, newCustom));
    onClose();
  };

  const applyCustom = () => {
    if (!start || !end) return;
    apply('custom', `${start.replace(':', '')}-${end.replace(':', '')}`);
  };

  const fmt = (hhmm) => hhmm && hhmm.length === 4 ? `${hhmm.slice(0, 2)}:${hhmm.slice(2)}` : hhmm;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{shiftName || 'Shift'} options</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <button type="button" onClick={() => apply(null)}
            className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/50 ${!mode ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
            <MapPin className="w-4 h-4 text-blue-500" />
            <div><div className="font-medium">Onsite</div><div className="text-xs text-muted-foreground">Default shift schedule</div></div>
          </button>

          <button type="button" onClick={() => apply('wfh')}
            className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/50 ${mode === 'wfh' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
            <Home className="w-4 h-4 text-purple-500" />
            <div><div className="font-medium">Work From Home</div><div className="text-xs text-muted-foreground">Same hours, remote</div></div>
          </button>

          <div className={`rounded-lg border p-3 ${mode === 'custom' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <div><div className="font-medium text-sm">Custom Time</div><div className="text-xs text-muted-foreground">e.g. for approved half-days</div></div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1"><Label className="text-xs">Start</Label><Input type="time" value={fmt(start)} onChange={e => setStart(e.target.value)} className="mt-1" /></div>
              <div className="flex-1"><Label className="text-xs">End</Label><Input type="time" value={fmt(end)} onChange={e => setEnd(e.target.value)} className="mt-1" /></div>
              <Button type="button" size="sm" onClick={applyCustom} disabled={!start || !end}>Apply</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
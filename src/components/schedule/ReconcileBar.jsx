import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReconcileBar({ showActual, onToggleActual }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        Overlay actual attendance on top of the approved schedule to spot mismatches.
      </p>
      <Button variant="outline" size="sm" onClick={onToggleActual}>
        {showActual ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
        {showActual ? 'Hide actual' : 'Show actual'}
      </Button>
    </div>
  );
}
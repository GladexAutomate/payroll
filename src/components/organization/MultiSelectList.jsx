import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MultiSelectList({ items, selectedIds, onToggle, emptyText = 'No items available.' }) {
  if (!items.length) {
    return <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="space-y-2 max-h-64 overflow-auto pr-1">
      {items.map(item => {
        const selected = selectedIds.includes(item.id);
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={cn(
              'w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
              selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
            )}
          >
            <span className="text-sm font-medium truncate">{item.name}</span>
            {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function HierarchyColumn({ title, subtitle, items, selectedId, onSelect, onCreate, disabled, allowCreate = true }) {
  const [name, setName] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || disabled) return;
    await onCreate(name.trim());
    setName('');
  };

  return (
    <div className={cn('bg-card border border-border rounded-xl p-4 space-y-4', disabled && 'opacity-60')}>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>

      {allowCreate && (
        <div className="flex gap-2">
          <Input
            value={name}
            disabled={disabled}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={`Add ${title.toLowerCase()}`}
          />
          <Button size="icon" disabled={disabled || !name.trim()} onClick={handleCreate}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">No records yet.</div>
        ) : items.map(item => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              'w-full text-left rounded-lg border px-3 py-2 transition-colors',
              selectedId === item.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
            )}
          >
            <p className="text-sm font-medium truncate">{item.name}</p>
            {item.leader_name && <p className="text-xs text-muted-foreground truncate">Leader: {item.leader_name}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
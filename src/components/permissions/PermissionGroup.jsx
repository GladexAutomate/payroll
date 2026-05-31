import { Switch } from '@/components/ui/switch';

export default function PermissionGroup({ group, allowed, onToggle, onToggleGroup }) {
  const GroupIcon = group.icon;
  const paths = group.items.map((item) => item.path);
  const allOn = paths.every((p) => allowed.includes(p));
  const someOn = paths.some((p) => allowed.includes(p));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <GroupIcon className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{group.label}</span>
        </div>
        <button
          onClick={() => onToggleGroup(paths, allOn)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {allOn ? 'Disable all' : 'Enable all'}
        </button>
      </div>
      <div className="divide-y divide-border/60">
        {group.items.map((item) => {
          const ItemIcon = item.icon;
          const on = allowed.includes(item.path);
          return (
            <div key={item.path} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <ItemIcon className={`w-4 h-4 ${on ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm">{item.label}</span>
              </div>
              <Switch checked={on} onCheckedChange={() => onToggle(item.path)} />
            </div>
          );
        })}
      </div>
      {someOn && !allOn && <div className="h-0.5 bg-primary/20" />}
    </div>
  );
}
import { TIERS } from '@/lib/roleHierarchy';

export default function RoleHierarchyRow({ role, tier, isOverride, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-card">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{role.label}</p>
        {!isOverride && <p className="text-[11px] text-muted-foreground">auto</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        {TIERS.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(role, t.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              tier === t.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-border hover:bg-muted text-muted-foreground'
            }`}
          >
            {t.label.split(' ')[0]}
          </button>
        ))}
      </div>
    </div>
  );
}
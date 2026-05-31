import { TIERS } from '@/lib/roleHierarchy';

export default function RoleHierarchyRow({ role, tier, isOverride, onChange }) {
  return (
    <div className="px-3 py-2.5 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-medium break-words" title={role.label}>{role.label}</p>
        {!isOverride && <span className="text-[10px] text-muted-foreground shrink-0">auto</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {TIERS.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(role, t.key)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
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
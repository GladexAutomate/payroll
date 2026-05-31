import { Loader2, HeartHandshake, Briefcase, Users, User } from 'lucide-react';
import { TIERS } from '@/lib/roleHierarchy';

const TIER_ICONS = {
  hr: HeartHandshake,
  managers: Briefcase,
  leaders: Users,
  employees: User,
};

export default function TierSelect({ counts = {}, loading, selected, onSelect }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Hierarchy Tier</label>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          {TIERS.map((tier) => {
            const Icon = TIER_ICONS[tier.key];
            const isActive = selected?.key === tier.key;
            return (
              <button
                key={tier.key}
                onClick={() => onSelect(tier)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border text-left transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-border hover:bg-muted text-foreground'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold leading-tight">{tier.label}</p>
                  <p className={`text-[11px] ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {counts[tier.key] || 0} role{(counts[tier.key] || 0) === 1 ? '' : 's'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
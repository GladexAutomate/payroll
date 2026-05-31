import { Loader2, Briefcase, Users, User } from 'lucide-react';
import { groupRolesByTier } from '@/lib/roleHierarchy';

const TIER_ICONS = {
  managers: Briefcase,
  leaders: Users,
  employees: User,
};

export default function RoleSelect({ roles, loading, selected, onSelect, overrides = {} }) {
  const tiers = groupRolesByTier(roles, overrides);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Role (employee job title)</label>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading roles...</div>
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-2">No job titles found on employee records.</p>
      ) : (
        <div className="space-y-4 mt-3">
          {tiers.map((tier) => {
            const Icon = TIER_ICONS[tier.key];
            return (
              <div key={tier.key}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">{tier.label}</span>
                  <span className="text-[11px] text-muted-foreground">({tier.roles.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tier.roles.map((role) => (
                    <button
                      key={role.value}
                      onClick={() => onSelect(role)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        selected?.value === role.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
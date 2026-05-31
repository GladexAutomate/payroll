import { Loader2 } from 'lucide-react';

export default function RoleSelect({ roles, loading, selected, onSelect }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Role (employee job title)</label>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading roles...</div>
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-2">No job titles found on employee records.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3">
          {roles.map((role) => (
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
      )}
    </div>
  );
}
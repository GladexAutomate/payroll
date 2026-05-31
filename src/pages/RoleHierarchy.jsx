import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Network, Loader2, ShieldAlert, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePagePermissions } from '@/lib/usePagePermissions';
import { TIERS, resolveTier } from '@/lib/roleHierarchy';
import RoleHierarchyRow from '@/components/permissions/RoleHierarchyRow';

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

export default function RoleHierarchy() {
  const { isAdmin, loading: loadingPerms } = usePagePermissions();
  const [roles, setRoles] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [res, hierarchyRecords] = await Promise.all([
        base44.functions.invoke('airtableEmployees', { action: 'employeeAccounts' }),
        base44.entities.RoleHierarchy.list('-updated_date', 5000),
      ]);
      const titles = [...new Set((res.data.accounts || [])
        .map((a) => String(a.job_title || '').trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .map((label) => ({ label, value: normalizeRole(label) }));
      setRoles(titles);
      const map = {};
      hierarchyRecords.forEach((r) => { map[r.role] = r.tier; });
      setOverrides(map);
      setLoading(false);
    })();
  }, []);

  const changeTier = (role, tier) => {
    setOverrides((prev) => ({ ...prev, [role.value]: tier }));
    setSavedNote('');
  };

  const save = async () => {
    setSaving(true);
    const existing = await base44.entities.RoleHierarchy.list('-updated_date', 5000);
    const byRole = existing.reduce((m, r) => ({ ...m, [r.role]: r }), {});
    for (const role of roles) {
      const tier = overrides[role.value];
      if (!tier) continue;
      const data = { role: role.value, role_label: role.label, tier };
      if (byRole[role.value]) await base44.entities.RoleHierarchy.update(byRole[role.value].id, data);
      else await base44.entities.RoleHierarchy.create(data);
    }
    setSaving(false);
    setSavedNote('Hierarchy saved.');
  };

  if (loadingPerms) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-card border border-border rounded-2xl p-8 text-center">
        <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Admins only</h2>
        <p className="text-sm text-muted-foreground mt-1">Only administrators can manage the role hierarchy.</p>
      </div>
    );
  }

  const filtered = roles.filter((r) => r.label.toLowerCase().includes(search.toLowerCase()));
  const byTier = TIERS.map((tier) => ({
    ...tier,
    roles: filtered.filter((r) => resolveTier(r, overrides) === tier.key),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Network className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Role Hierarchy</h1>
          <p className="text-sm text-muted-foreground">Manually assign each job title to a tier. Used to group roles on the Permissions page.</p>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">How to set up:</span> Each job title starts on an auto-detected tier (shown with an <span className="font-medium">auto</span> tag). Click <span className="font-medium">HR</span>, <span className="font-medium">Managers</span>, <span className="font-medium">Leaders</span>, or <span className="font-medium">Employees</span> on a role to move it. The role jumps to that column. When done, press <span className="font-medium">Save Hierarchy</span>.
      </div>

      <Input placeholder="Search job titles..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading roles...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {byTier.map((tier) => (
            <div key={tier.key} className="bg-muted/30 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">{tier.label}</span>
                <span className="text-xs text-muted-foreground">{tier.roles.length}</span>
              </div>
              <div className="space-y-2">
                {tier.roles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No roles</p>
                ) : tier.roles.map((role) => (
                  <RoleHierarchyRow
                    key={role.value}
                    role={role}
                    tier={resolveTier(role, overrides)}
                    isOverride={!!overrides[role.value]}
                    onChange={changeTier}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 bg-background/90 backdrop-blur border-t border-border py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{savedNote || 'Assign tiers, then save.'}</p>
        <Button onClick={save} disabled={saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Save Hierarchy
        </Button>
      </div>
    </div>
  );
}
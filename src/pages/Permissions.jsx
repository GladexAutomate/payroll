import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { KeyRound, Save, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navGroups } from '@/lib/navConfig';
import { usePagePermissions } from '@/lib/usePagePermissions';
import { groupRolesByTier } from '@/lib/roleHierarchy';
import PermissionGroup from '@/components/permissions/PermissionGroup';
import RoleSelect from '@/components/permissions/RoleSelect';

const normalizeRole = (value) => String(value || '').trim().toLowerCase();
// Groups whose pages can be toggled (exclude adminOnly items via navConfig filtering below).
const editableGroups = navGroups
  .map((group) => ({ ...group, items: group.items.filter((item) => !item.adminOnly) }))
  .filter((group) => group.items.length > 0);

export default function Permissions() {
  const { isAdmin, loading: loadingPerms } = usePagePermissions();
  const [roles, setRoles] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [allowed, setAllowed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState('');

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

  const selectRole = async (role) => {
    setSelectedRole(role);
    setSavedNote('');
    const records = await base44.entities.RolePagePermission.filter({ role: role.value }, '-updated_date', 1);
    setAllowed(records.length ? (records[0].allowed_paths || []) : ['/']);
  };

  const togglePath = (path) => {
    setAllowed((prev) => prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]);
    setSavedNote('');
  };

  const toggleGroup = (paths, allOn) => {
    setAllowed((prev) => allOn ? prev.filter((p) => !paths.includes(p)) : [...new Set([...prev, ...paths])]);
    setSavedNote('');
  };

  const save = async () => {
    if (!selectedRole) return;
    setSaving(true);
    const existing = await base44.entities.RolePagePermission.filter({ role: selectedRole.value }, '-updated_date', 1);
    const data = { role: selectedRole.value, role_label: selectedRole.label, allowed_paths: allowed };
    if (existing.length) await base44.entities.RolePagePermission.update(existing[0].id, data);
    else await base44.entities.RolePagePermission.create(data);
    setSaving(false);
    setSavedNote('Permissions saved. Users with this role will see the change on their next page load.');
  };

  if (loadingPerms) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-card border border-border rounded-2xl p-8 text-center">
        <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Admins only</h2>
        <p className="text-sm text-muted-foreground mt-1">Only administrators can manage page permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Page Permissions</h1>
          <p className="text-sm text-muted-foreground">Control which pages each role can access. Admins always see everything.</p>
        </div>
      </div>

      <RoleSelect roles={roles} loading={loading} selected={selectedRole} onSelect={selectRole} overrides={overrides} />

      {selectedRole && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editableGroups.map((group) => (
              <PermissionGroup
                key={group.label}
                group={group}
                allowed={allowed}
                onToggle={togglePath}
                onToggleGroup={toggleGroup}
              />
            ))}
          </div>

          <div className="sticky bottom-0 bg-background/90 backdrop-blur border-t border-border py-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {savedNote || `${allowed.length} page${allowed.length === 1 ? '' : 's'} enabled for ${selectedRole.label}`}
            </p>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save Permissions
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
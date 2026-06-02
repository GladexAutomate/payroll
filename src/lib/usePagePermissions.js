import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { allAssignablePaths } from '@/lib/navConfig';
import { hasAdminAccess } from '@/lib/adminAccess';
import { resolveTier, tierPermissionKey } from '@/lib/roleHierarchy';

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

// Loads the current user and resolves which page paths they may access.
// - Admins (platform role 'admin') get everything.
// - Everyone else is gated by the hierarchy TIER of their internal_role (employee Job Title).
//   The role's tier is resolved from its RoleHierarchy override (or auto-classified), and
//   page access is read from the RolePagePermission record stored for that tier.
// - If no permission record exists for the tier yet, default to allowing the Dashboard only.
export function usePagePermissions() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState('');
  const [allowedPaths, setAllowedPaths] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (hasAdminAccess()) {
          setIsAdmin(true);
          setRole('admin');
          setAllowedPaths(allAssignablePaths);
          setLoading(false);
          return;
        }

        const user = await base44.auth.me();
        if (!active) return;

        if (user?.role === 'admin') {
          setIsAdmin(true);
          setAllowedPaths(allAssignablePaths);
          setLoading(false);
          return;
        }

        const userRole = normalizeRole(user?.internal_role);
        setRole(userRole);

        if (!userRole) {
          setAllowedPaths(['/']);
          setLoading(false);
          return;
        }

        // Resolve the tier for this role: prefer a manual RoleHierarchy override, else auto-classify.
        const hierarchy = await base44.entities.RoleHierarchy.filter({ role: userRole }, '-updated_date', 1);
        const tier = hierarchy.length
          ? hierarchy[0].tier
          : resolveTier({ value: userRole, label: user?.internal_role }, {});

        const records = await base44.entities.RolePagePermission.filter({ role: tierPermissionKey(tier) }, '-updated_date', 1);
        const allowed = records.length ? (records[0].allowed_paths || []) : ['/'];
        if (active) setAllowedPaths(allowed.length ? allowed : ['/']);
      } catch {
        if (active) setAllowedPaths(['/']);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const canAccess = (path) => isAdmin || allowedPaths.includes(path);

  return { loading, isAdmin, role, allowedPaths, canAccess };
}

import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { allAssignablePaths } from '@/lib/navConfig';

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

// Loads the current user and resolves which page paths they may access.
// - Admins (platform role 'admin') get everything.
// - Everyone else is gated by their internal_role (employee Job Title) via RolePagePermission.
// - If no permission record exists for the role yet, default to allowing the Dashboard only.
export function usePagePermissions() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState('');
  const [allowedPaths, setAllowedPaths] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
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

        const records = await base44.entities.RolePagePermission.filter({ role: userRole }, '-updated_date', 1);
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
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ADMIN_USER, hasAdminAccess } from '@/lib/adminAccess';
import { resolveTier } from '@/lib/roleHierarchy';

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

// Resolves the current user's hierarchy tier ('hr' | 'managers' | 'leaders' | 'employees')
// and a display name to stamp on signatures. Admin / platform-admin are treated as HR Admin.
export function useCurrentTier() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState('employees');
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (hasAdminAccess()) {
          if (!active) return;
          setTier('hr');
          setSignerName(ADMIN_USER?.full_name || 'HR Admin');
          setSignerRole('HR Admin');
          setUserId('admin');
          setLoading(false);
          return;
        }

        const me = await base44.auth.me();
        if (!active) return;
        setUserId(me?.id || '');
        setSignerName(me?.full_name || me?.email || 'User');
        setSignerRole(me?.internal_role || '');

        if (me?.role === 'admin') {
          setTier('hr');
          setLoading(false);
          return;
        }

        const userRole = normalizeRole(me?.internal_role);
        let resolved = 'employees';
        if (userRole) {
          const hierarchy = await base44.entities.RoleHierarchy.filter({ role: userRole }, '-updated_date', 1);
          resolved = hierarchy.length ? hierarchy[0].tier : resolveTier({ value: userRole, label: me?.internal_role }, {});
        }
        if (active) setTier(resolved);
      } catch {
        if (active) setTier('employees');
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return { loading, tier, signerName, signerRole, userId };
}
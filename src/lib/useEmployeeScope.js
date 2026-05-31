import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { resolveTier } from '@/lib/roleHierarchy';

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

// Tiers that may see ALL employees' requests. The "employees" tier is restricted to their own.
const PRIVILEGED_TIERS = new Set(['hr', 'managers', 'leaders']);

// Resolves the current user and whether they should be limited to their OWN records only.
// Employee-tier (non-admin) users get selfOnly=true plus an `ownIds` set used to filter records
// and an `ownEmployeeId` used to lock the "file request" form to themselves.
export function useEmployeeScope() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selfOnly, setSelfOnly] = useState(false);
  const [ownIds, setOwnIds] = useState(new Set());
  const [ownEmployeeId, setOwnEmployeeId] = useState('');
  const [ownName, setOwnName] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!active) return;
        setUser(me);

        if (me?.role === 'admin') {
          setSelfOnly(false);
          setLoading(false);
          return;
        }

        const userRole = normalizeRole(me?.internal_role);
        let tier = 'employees';
        if (userRole) {
          const hierarchy = await base44.entities.RoleHierarchy.filter({ role: userRole }, '-updated_date', 1);
          tier = hierarchy.length ? hierarchy[0].tier : resolveTier({ value: userRole, label: me?.internal_role }, {});
        }

        if (PRIVILEGED_TIERS.has(tier)) {
          setSelfOnly(false);
          setLoading(false);
          return;
        }

        // Employee tier: build the set of IDs that identify this user's own records.
        const airtableRecordId = me?.employee_airtable_record_id || '';
        const ids = new Set();
        let selfEmployeeId = airtableRecordId;
        if (airtableRecordId) {
          ids.add(airtableRecordId);
          const recs = await base44.entities.AirtableEmployeeRecord.filter({ airtable_record_id: airtableRecordId }, '-updated_date', 1);
          if (recs.length) {
            ids.add(recs[0].id);
            selfEmployeeId = recs[0].id;
            setOwnName(recs[0].full_name || recs[0].fields?.['Full Name'] || '');
          }
        }

        setOwnIds(ids);
        setOwnEmployeeId(selfEmployeeId);
        setSelfOnly(true);
      } catch {
        // On failure, fail safe to self-only with no ids (sees nothing they can't prove is theirs).
        if (active) setSelfOnly(true);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // True if a record belongs to the current user (or scoping is not active).
  const isOwn = (employeeId) => !selfOnly || ownIds.has(String(employeeId || ''));

  return { loading, user, selfOnly, ownIds, ownEmployeeId, ownName, isOwn };
}
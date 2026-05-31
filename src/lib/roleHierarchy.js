// Classify an employee job title into one of three tiers for the permissions UI.
// Order matters: manager keywords are checked before leader/supervisor keywords.

const MANAGER_KEYWORDS = [
  'manager', 'head', 'chief', 'director', 'officer', 'executive', 'ceo', 'coo',
  'cto', 'cfo', 'president', 'vp', 'vice president',
];

const LEADER_KEYWORDS = [
  'leader', 'lead', 'supervisor', 'coach', 'team leader', 'tl',
];

export const TIERS = [
  { key: 'managers', label: 'Managers' },
  { key: 'leaders', label: 'Leaders & Supervisors' },
  { key: 'employees', label: 'Employees' },
];

export function classifyRole(label) {
  const text = String(label || '').toLowerCase();
  if (MANAGER_KEYWORDS.some((kw) => text.includes(kw))) return 'managers';
  if (LEADER_KEYWORDS.some((kw) => text.includes(kw))) return 'leaders';
  return 'employees';
}

export function groupRolesByTier(roles) {
  const buckets = { managers: [], leaders: [], employees: [] };
  roles.forEach((role) => {
    buckets[classifyRole(role.label)].push(role);
  });
  return TIERS
    .map((tier) => ({ ...tier, roles: buckets[tier.key] }))
    .filter((tier) => tier.roles.length > 0);
}
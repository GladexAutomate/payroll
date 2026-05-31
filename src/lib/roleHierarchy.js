// Classify an employee job title into one of three tiers for the permissions UI.
// Order matters: manager keywords are checked before leader/supervisor keywords.

const HR_KEYWORDS = [
  'human resource', 'hr ', 'hr-', 'hr/', 'hris', 'recruit', 'talent acquisition',
  'people operations', 'people & culture',
];

const MANAGER_KEYWORDS = [
  'manager', 'head', 'chief', 'director', 'officer', 'executive', 'ceo', 'coo',
  'cto', 'cfo', 'president', 'vp', 'vice president',
];

const LEADER_KEYWORDS = [
  'leader', 'lead', 'supervisor', 'coach', 'team leader', 'tl',
];

export const TIERS = [
  { key: 'hr', label: 'HR' },
  { key: 'managers', label: 'Managers' },
  { key: 'leaders', label: 'Leaders & Supervisors' },
  { key: 'employees', label: 'Employees' },
];

// Automatic guess based on keywords (used as the default when no manual override exists).
export function classifyRole(label) {
  const text = ` ${String(label || '').toLowerCase()} `;
  if (HR_KEYWORDS.some((kw) => text.includes(kw))) return 'hr';
  if (MANAGER_KEYWORDS.some((kw) => text.includes(kw))) return 'managers';
  if (LEADER_KEYWORDS.some((kw) => text.includes(kw))) return 'leaders';
  return 'employees';
}

// Resolve the tier for a role, preferring a manual override map ({ [roleValue]: tier }).
export function resolveTier(role, overrides = {}) {
  return overrides[role.value] || classifyRole(role.label);
}

// RolePagePermission.role value used to store permissions for a whole tier.
export function tierPermissionKey(tierKey) {
  return `tier:${tierKey}`;
}

export function groupRolesByTier(roles, overrides = {}) {
  const buckets = { hr: [], managers: [], leaders: [], employees: [] };
  roles.forEach((role) => {
    buckets[resolveTier(role, overrides)].push(role);
  });
  return TIERS
    .map((tier) => ({ ...tier, roles: buckets[tier.key] }))
    .filter((tier) => tier.roles.length > 0);
}
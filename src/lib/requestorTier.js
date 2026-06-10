import { base44 } from '@/api/base44Client';
import { resolveTier } from '@/lib/roleHierarchy';
import { getAirtableEmployeeFields } from '@/utils/airtableEmployee';

const normalize = (v) => String(v || '').trim().toLowerCase();

// The employee's job title used to classify their hierarchy tier.
export function getEmployeeJobTitle(employee) {
  const fields = getAirtableEmployeeFields(employee);
  return (
    employee?.department_role ||
    fields['Job Title'] ||
    fields['Position'] ||
    fields['Role'] ||
    employee?.position ||
    ''
  );
}

// Resolve the hierarchy tier ('hr'|'managers'|'leaders'|'employees') for a set of employees,
// preferring RoleHierarchy overrides, falling back to keyword auto-classification.
// Returns a map keyed by both employee.id and airtable_record_id -> tier.
export async function buildRequestorTierMap(employees = []) {
  const titles = [...new Set(employees.map((e) => normalize(getEmployeeJobTitle(e))).filter(Boolean))];
  const overrides = {};
  if (titles.length) {
    const rows = await base44.entities.RoleHierarchy.list('-updated_date', 1000);
    rows.forEach((r) => { overrides[normalize(r.role)] = r.tier; });
  }
  const map = {};
  for (const e of employees) {
    const title = normalize(getEmployeeJobTitle(e));
    const tier = overrides[title] || resolveTier({ value: title, label: getEmployeeJobTitle(e) }, {});
    if (e.id) map[e.id] = tier;
    if (e.airtable_record_id) map[e.airtable_record_id] = tier;
  }
  return map;
}
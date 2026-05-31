// Groups a flat list of org items into Company → Branch sections for display.
// Each item is expected to have company_name and branch_name fields.
export function groupByCompanyBranch(items) {
  const map = new Map();
  for (const item of items) {
    const company = item.company_name || 'Unassigned Company';
    const branch = item.branch_name || 'Unassigned Branch';
    const key = `${company}|||${branch}`;
    if (!map.has(key)) map.set(key, { company, branch, items: [] });
    map.get(key).items.push(item);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.company.localeCompare(b.company) || a.branch.localeCompare(b.branch)
  );
}
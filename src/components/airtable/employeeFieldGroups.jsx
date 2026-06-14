// Groups Airtable employee columns into logical HR sections for the edit form.
// Classification is keyword-based so it works even as columns are added/renamed.

export const GROUP_ORDER = [
  'Identity',
  'Job & Organization',
  'Compensation',
  'Government IDs',
  'Contact',
  'Dates & Tenure',
  'Attendance & Performance',
  'Documents & Files',
  'System',
  'Other',
];

const RULES = [
  ['Identity', [
    'employee code', 'employee #', 'employee number', 'first name', 'middle name',
    'last name', 'full name', 'nickname', 'gender', 'sex', 'birthday', 'birth date',
    'date of birth', 'birth month', 'age', 'civil status', 'marital', 'nationality',
    'religion', 'blood type', 'photo', 'picture', 'avatar',
  ]],
  ['Job & Organization', [
    'company', 'branch', 'department', 'department role', 'sub department', 'team',
    'job title', 'position', 'role', 'employment type', 'employment status',
    'rank', 'level', 'grade', 'immediate head', 'immediate supervisor', 'supervisor',
    'manager', 'reports to', 'reporting',
  ]],
  ['Compensation', [
    'salary', 'rate', 'wage', 'pay', 'allowance', 'allowances', 'bonus', 'incentive',
    'commission', 'compensation', 'basic', 'monthly salary', 'daily rate', 'hourly',
  ]],
  ['Government IDs', [
    'sss', 'philhealth', 'phil health', 'pag-ibig', 'pagibig', 'pag ibig', 'hdmf',
    'tin', 'tax', 'umid', 'gsis', 'government', 'biometric', 'biometrics',
  ]],
  ['Contact', [
    'email', 'mobile', 'phone', 'contact', 'address', 'city', 'province', 'zip',
    'emergency', 'telephone',
  ]],
  ['Dates & Tenure', [
    'date hired', 'hire date', 'date started', 'start date', 'end date', 'regularization',
    'regularized', 'end of training', 'end of probation', 'tenure', 'years of service',
    'resigned', 'separation', 'termination', 'date of', 'effective',
  ]],
  ['Attendance & Performance', [
    'attendance', 'kpi', 'quota', 'performance', 'rating', 'evaluation', 'leave',
    'absence', 'tardiness', 'late', 'undertime', 'overtime', 'schedule',
  ]],
  ['Documents & Files', [
    'file', 'files', 'attachment', 'attachments', 'document', 'documents', 'contract',
    'atd', 'memo', 'requirement', 'requirements', '201', 'asset', 'assets',
  ]],
  ['System', [
    'record id', 'created', 'modified', 'updated', 'last updated', 'formula', 'sync',
    'notes', 'remarks',
  ]],
];

function classify(column) {
  const c = String(column || '').toLowerCase().trim();
  for (const [group, keywords] of RULES) {
    if (keywords.some(k => c === k || c.includes(k))) return group;
  }
  return 'Other';
}

/**
 * Returns ordered groups: [{ group, columns: [...] }] preserving the incoming
 * column order within each group and dropping empty groups.
 */
export function groupEmployeeColumns(columns) {
  const buckets = {};
  for (const col of columns) {
    const group = classify(col);
    (buckets[group] = buckets[group] || []).push(col);
  }
  return GROUP_ORDER
    .filter(group => buckets[group]?.length)
    .map(group => ({ group, columns: buckets[group] }));
}
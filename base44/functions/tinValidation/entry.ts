import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function cleanText(value) {
  return String(value || '').trim();
}

function getFields(employee) {
  return employee?.fields || {};
}

function getName(employee) {
  const fields = getFields(employee);
  return cleanText(employee.full_name || fields['Full Name'] || [fields['First Name'], fields['Middle Name'], fields['Last Name']].filter(Boolean).join(' '));
}

function getCode(employee) {
  const fields = getFields(employee);
  return cleanText(employee.employee_code || fields['Employee Code ID'] || fields['Employee Code']);
}

function getTIN(employee) {
  const fields = getFields(employee);
  return cleanText(fields['TIN'] || fields['Tin'] || fields['TIN Number'] || fields['Tax Identification Number']);
}

// Valid PH TIN = 9 or 12 digits (with optional separators). Returns a status label.
function classifyTIN(rawTin) {
  if (!rawTin) return { status: 'missing', digits: '' };
  const digits = rawTin.replace(/\D/g, '');
  if (digits.length === 9 || digits.length === 12) return { status: 'valid', digits };
  return { status: 'invalid', digits };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const branchNorm = cleanText(body.branch).toLowerCase();

    const allEmployees = await base44.asServiceRole.entities.AirtableEmployeeRecord.list('-updated_date', 5000);
    const employees = allEmployees.filter((emp) => {
      if (cleanText(getFields(emp).Status).toLowerCase() !== 'active') return false;
      if (branchNorm && cleanText(emp.branch || getFields(emp).Branch).toLowerCase() !== branchNorm) return false;
      return true;
    });

    const results = employees.map((emp) => {
      const tin = getTIN(emp);
      const { status } = classifyTIN(tin);
      return {
        employee_id: emp.id,
        employee_code: getCode(emp),
        employee_name: getName(emp),
        tin: tin || '',
        status,
      };
    }).sort((a, b) => a.employee_name.localeCompare(b.employee_name));

    const summary = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, { valid: 0, invalid: 0, missing: 0 });

    return Response.json({
      total: results.length,
      summary,
      employees: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
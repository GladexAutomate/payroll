import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function cleanText(value) {
  return String(value || '').trim();
}

// 2023 BIR annual graduated income tax table (TRAIN law).
function annualTaxDue(taxable) {
  const t = Math.max(0, Number(taxable) || 0);
  if (t <= 250000) return 0;
  if (t <= 400000) return (t - 250000) * 0.15;
  if (t <= 800000) return 22500 + (t - 400000) * 0.20;
  if (t <= 2000000) return 102500 + (t - 800000) * 0.25;
  if (t <= 8000000) return 402500 + (t - 2000000) * 0.30;
  return 2202500 + (t - 8000000) * 0.35;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const report = cleanText(body.report) || '1601c';
    const year = Number(body.year) || new Date().getFullYear();
    const month = body.month ? Number(body.month) : null;
    const branchNorm = cleanText(body.branch).toLowerCase();

    // Pull all attendance pay summaries; filter by year/month/branch in memory.
    const all = await base44.asServiceRole.entities.AttendancePaySummary.list('-period_start', 20000);

    // Optional branch lookup: AttendancePaySummary has no branch, so match via AirtableEmployeeRecord.
    let branchEmployeeIds = null;
    if (branchNorm) {
      const emps = await base44.asServiceRole.entities.AirtableEmployeeRecord.list('-updated_date', 5000);
      branchEmployeeIds = new Set(
        emps
          .filter((e) => cleanText(e.branch || e.fields?.Branch).toLowerCase() === branchNorm)
          .map((e) => e.id)
      );
    }

    const summaries = all.filter((s) => {
      const start = s.period_start ? new Date(s.period_start) : null;
      if (!start || start.getFullYear() !== year) return false;
      if (month && start.getMonth() + 1 !== month) return false;
      if (branchEmployeeIds && !branchEmployeeIds.has(s.employee_id)) return false;
      return true;
    });

    // ---- 1601-C: monthly remittance summary ----
    if (report === '1601c') {
      const employeeIds = new Set(summaries.map((s) => s.employee_id));
      const totals = summaries.reduce(
        (acc, s) => {
          acc.gross += Number(s.gross || 0) + Number(s.allowances || 0);
          acc.tax += Number(s.withholding_tax || 0);
          return acc;
        },
        { gross: 0, tax: 0 }
      );
      return Response.json({
        report: '1601c',
        year,
        month,
        employee_count: employeeIds.size,
        total_gross: totals.gross,
        total_withholding_tax: totals.tax,
      });
    }

    // ---- 1604-C / 2316 / annualization: aggregate per employee for the year ----
    const byEmployee = new Map();
    for (const s of summaries) {
      const id = s.employee_id;
      if (!byEmployee.has(id)) {
        byEmployee.set(id, {
          employee_id: id,
          employee_code: s.employee_code || '',
          employee_name: s.employee_name || '',
          gross: 0,
          sss: 0,
          philhealth: 0,
          pagibig: 0,
          tax_withheld: 0,
        });
      }
      const e = byEmployee.get(id);
      e.gross += Number(s.gross || 0) + Number(s.allowances || 0);
      e.sss += Number(s.sss_employee || 0);
      e.philhealth += Number(s.philhealth_employee || 0);
      e.pagibig += Number(s.pagibig_employee || 0);
      e.tax_withheld += Number(s.withholding_tax || 0);
    }

    const isAnnualization = report === 'annualization';
    const employees = [...byEmployee.values()].map((e) => {
      const total_contributions = e.sss + e.philhealth + e.pagibig;
      const taxable_income = Math.max(0, e.gross - total_contributions);
      const result = {
        ...e,
        total_contributions,
        taxable_income,
      };
      if (isAnnualization) {
        const due = annualTaxDue(taxable_income);
        result.annual_tax_due = due;
        result.adjustment = due - e.tax_withheld; // >0 collect, <0 refund
      }
      return result;
    }).sort((a, b) => a.employee_name.localeCompare(b.employee_name));

    const totals = employees.reduce(
      (acc, e) => {
        acc.gross += e.gross;
        acc.sss += e.sss;
        acc.philhealth += e.philhealth;
        acc.pagibig += e.pagibig;
        acc.taxable_income += e.taxable_income;
        acc.tax_withheld += e.tax_withheld;
        if (isAnnualization) {
          acc.annual_tax_due += e.annual_tax_due || 0;
          acc.adjustment += e.adjustment || 0;
        }
        return acc;
      },
      { gross: 0, sss: 0, philhealth: 0, pagibig: 0, taxable_income: 0, tax_withheld: 0, annual_tax_due: 0, adjustment: 0 }
    );

    return Response.json({
      report,
      year,
      branch: cleanText(body.branch),
      employees,
      totals,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
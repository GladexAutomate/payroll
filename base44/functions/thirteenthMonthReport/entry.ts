import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function cleanText(value) {
  return String(value || '').trim();
}
function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

// Schedule card keys that count as PAID days when projecting from plotted schedules.
const COST_COUNTED_TYPES = new Set(['opener', 'closer', 'wfh', 'paid_vl', 'sick', 'maternity', 'paternity']);
function isPaidScheduleDay(type) {
  return COST_COUNTED_TYPES.has(type) || String(type || '').startsWith('shift:');
}
// Required paid working days in a month (mirrors getMonthlyWorkDays: days - floor(days/7)).
function monthlyWorkDays(year, month0) {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  return Math.max(1, daysInMonth - Math.floor(daysInMonth / 7));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const year = Number(body.year) || new Date().getFullYear();
    const branchNorm = cleanText(body.branch).toLowerCase();

    // SOURCE OF TRUTH: only APPROVED payroll, archived in ApprovedPayrollHistory.
    // Each history row holds a snapshot of the run plus every employee PayrollRecord.
    const history = await base44.asServiceRole.entities.ApprovedPayrollHistory.list('-period_start', 20000);

    // Branch filter via AirtableEmployeeRecord (for the plotted-schedule projection).
    let branchEmployeeIds = null;
    if (branchNorm) {
      const emps = await base44.asServiceRole.entities.AirtableEmployeeRecord.list('-updated_date', 5000);
      branchEmployeeIds = new Set(
        emps
          .filter((e) => cleanText(e.branch || e.fields?.Branch).toLowerCase() === branchNorm)
          .map((e) => e.id)
      );
    }

    // Aggregate per employee from approved payroll snapshots.
    const byEmployee = new Map();
    for (const h of history) {
      const start = h.period_start ? new Date(h.period_start) : null;
      if (!start || start.getFullYear() !== year) continue;
      if (branchNorm && cleanText(h.branch_name).toLowerCase() !== branchNorm) continue;
      const month0 = start.getMonth(); // 0-11
      const records = Array.isArray(h.records_snapshot) ? h.records_snapshot : [];
      for (const r of records) {
        if (r.is_held) continue; // held salaries were excluded from the approved run
        const id = r.employee_id;
        if (!id) continue;
        if (branchEmployeeIds && !branchEmployeeIds.has(id)) continue;
        if (!byEmployee.has(id)) {
          byEmployee.set(id, {
            employee_id: id,
            employee_code: r.employee_code || '',
            employee_name: r.employee_name || '',
            basic_salary: Number(r.basic_salary || 0),
            basic_earned: 0,
            months: new Set(),          // months with approved payroll data
            projected_months: new Set(), // months filled in from plotted schedule
            monthly: new Map(),         // month0 -> basic earned that month
          });
        }
        const e = byEmployee.get(id);
        // "basic salary earned" = regular (basic) pay actually earned this approved period.
        const earned = Number(r.regular_pay || 0);
        e.basic_earned += earned;
        if (Number(r.basic_salary || 0) > 0) e.basic_salary = Number(r.basic_salary);
        e.months.add(month0);
        e.monthly.set(month0, (e.monthly.get(month0) || 0) + earned);
      }
    }

    // For the current year, precompute months that have plotted schedules but no
    // actual reconciled summary yet (e.g. December still in progress). We project
    // pay from the plotted ApprovedSchedule: dailyRate × paid plotted days.
    if (year === new Date().getFullYear()) {
      const schedules = await base44.asServiceRole.entities.ApprovedSchedule.list('-date', 50000);
      // Group plotted paid days by employee+month.
      const plotted = new Map(); // empId -> Map(month0 -> paidDays)
      for (const sc of schedules) {
        if (!sc.date) continue;
        const d = new Date(sc.date);
        if (d.getFullYear() !== year) continue;
        if (branchEmployeeIds && !branchEmployeeIds.has(sc.employee_id)) continue;
        if (!isPaidScheduleDay(sc.schedule_type)) continue;
        const month0 = d.getMonth();
        if (!plotted.has(sc.employee_id)) plotted.set(sc.employee_id, new Map());
        const mm = plotted.get(sc.employee_id);
        mm.set(month0, (mm.get(month0) || 0) + 1);
      }

      // Seed identity/salary for plotted employees who have no approved payroll yet,
      // so future-month projection still appears even before their first approved run.
      const missingIds = [...plotted.keys()].filter((id) => !byEmployee.has(id));
      if (missingIds.length) {
        const empRecords = await base44.asServiceRole.entities.AirtableEmployeeRecord.list('-updated_date', 5000);
        const empById = new Map(empRecords.map((e) => [e.id, e]));
        for (const id of missingIds) {
          const emp = empById.get(id);
          if (!emp) continue;
          const basic = Number(emp.fields?.['Basic Salary'] || emp.fields?.['Monthly Salary'] || 0);
          if (!(basic > 0)) continue;
          byEmployee.set(id, {
            employee_id: id,
            employee_code: emp.employee_code || '',
            employee_name: emp.full_name || '',
            basic_salary: basic,
            basic_earned: 0,
            months: new Set(),
            projected_months: new Set(),
            monthly: new Map(),
          });
        }
      }

      for (const [empId, monthMap] of plotted) {
        const e = byEmployee.get(empId);
        if (!e) continue; // no salary/identity data; skip projection
        if (!(Number(e.basic_salary) > 0)) continue;
        for (const [month0, paidDays] of monthMap) {
          if (e.months.has(month0)) continue; // actual data already exists for this month
          const dailyRate = Number(e.basic_salary) / monthlyWorkDays(year, month0);
          // Cap projected paid days at a full month's worth of working days.
          const cappedDays = Math.min(paidDays, monthlyWorkDays(year, month0));
          const projectedEarned = dailyRate * cappedDays;
          e.basic_earned += projectedEarned;
          e.projected_months.add(month0);
          e.monthly.set(month0, (e.monthly.get(month0) || 0) + projectedEarned);
        }
      }
    }

    const employees = [...byEmployee.values()].map((e) => {
      const allMonths = new Set([...e.months, ...e.projected_months]);
      const monthsWorked = allMonths.size;
      const projectedMonths = e.projected_months.size;
      const accrued = e.basic_earned / 12; // P.D. 851: total basic salary earned ÷ 12
      // Prorated full-year projection: project the monthly basic salary across the
      // months the employee was active this year (mid-year hire / resignation).
      const prorated = (e.basic_salary * monthsWorked) / 12;
      // Per-month breakdown for all 12 months (0 if no earnings that month).
      const monthly = [];
      for (let m = 0; m < 12; m++) {
        monthly.push({
          month: m,
          basic_earned: money(e.monthly.get(m) || 0),
          projected: e.projected_months.has(m),
        });
      }
      return {
        employee_id: e.employee_id,
        employee_code: e.employee_code,
        employee_name: e.employee_name,
        basic_salary: money(e.basic_salary),
        basic_earned: money(e.basic_earned),
        months_worked: monthsWorked,
        projected_months: projectedMonths,
        accrued: money(accrued),
        prorated: money(prorated),
        monthly,
      };
    }).sort((a, b) => a.employee_name.localeCompare(b.employee_name));

    const totals = employees.reduce(
      (acc, e) => {
        acc.basic_earned += e.basic_earned;
        acc.accrued += e.accrued;
        acc.prorated += e.prorated;
        return acc;
      },
      { basic_earned: 0, accrued: 0, prorated: 0 }
    );

    return Response.json({
      year,
      branch: cleanText(body.branch),
      employee_count: employees.length,
      employees,
      totals: {
        basic_earned: money(totals.basic_earned),
        accrued: money(totals.accrued),
        prorated: money(totals.prorated),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
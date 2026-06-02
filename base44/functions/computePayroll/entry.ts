import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function cleanText(value) {
  return String(value || '').trim();
}

function parseMoney(value) {
  const number = Number(cleanText(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function normalizeName(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  const raw = Array.isArray(value) ? value.join(' ') : value;
  return cleanText(raw).toLowerCase().replace(/\s+/g, ' ').trim();
}

function getFields(employee) {
  return employee?.fields || {};
}

function getEmployeeName(employee) {
  const fields = getFields(employee);
  return cleanText(employee.full_name || fields['Full Name'] || [fields['First Name'], fields['Middle Name'], fields['Last Name']].filter(Boolean).join(' '));
}

function getEmployeeCode(employee) {
  const fields = getFields(employee);
  return cleanText(employee.employee_code || fields['Employee Code ID'] || fields['Employee Code']);
}

function getBiometricNumber(employee) {
  return cleanText(getFields(employee)['Biometrics Number']);
}

function isActiveEmployee(employee) {
  return cleanText(getFields(employee).Status).toLowerCase() === 'active';
}

function buildEmployeeKeys(employee) {
  return [
    employee.id,
    employee.airtable_record_id,
    getEmployeeCode(employee),
    getBiometricNumber(employee),
    normalizeName(getEmployeeName(employee)),
  ].filter(Boolean).map(key => String(key).trim());
}

function getSSSContribution(monthlySalary, policy) {
  const maxEE = Number(policy?.sss_max_employee) || 900;
  const maxER = Number(policy?.sss_max_employer) || 1900;
  const table = [
    [4249.99, 180, 380], [4749.99, 202.5, 427.5], [5249.99, 225, 475], [5749.99, 247.5, 522.5],
    [6249.99, 270, 570], [6749.99, 292.5, 617.5], [7249.99, 315, 665], [7749.99, 337.5, 712.5],
    [8249.99, 360, 760], [8749.99, 382.5, 807.5], [9249.99, 405, 855], [9749.99, 427.5, 902.5],
    [10249.99, 450, 950], [10749.99, 472.5, 997.5], [11249.99, 495, 1045], [11749.99, 517.5, 1092.5],
    [12249.99, 540, 1140], [12749.99, 562.5, 1187.5], [13249.99, 585, 1235], [13749.99, 607.5, 1282.5],
    [14249.99, 630, 1330], [14749.99, 652.5, 1377.5], [15249.99, 675, 1425], [15749.99, 697.5, 1472.5],
    [16249.99, 720, 1520], [16749.99, 742.5, 1567.5], [17249.99, 765, 1615], [17749.99, 787.5, 1662.5],
    [18249.99, 810, 1710], [18749.99, 832.5, 1757.5], [19249.99, 855, 1805], [19749.99, 877.5, 1852.5],
    [20249.99, 900, 1900],
  ];
  if (monthlySalary < 4250) return { employee: 180, employer: 380 };
  for (const [cap, ee, er] of table) if (monthlySalary <= cap) return { employee: Math.min(ee, maxEE), employer: Math.min(er, maxER) };
  return { employee: maxEE, employer: maxER };
}

function getPhilHealthContribution(monthlySalary, policy) {
  const rate = Number(policy?.philhealth_rate) || 0.05;
  const floor = Number(policy?.philhealth_salary_floor) || 10000;
  const ceiling = Number(policy?.philhealth_salary_ceiling) || 100000;
  const bracket = Math.min(Math.max(monthlySalary, floor), ceiling);
  const total = bracket * rate;
  return { employee: total / 2, employer: total / 2 };
}

function getPagIBIGContribution(monthlySalary, policy) {
  const rate = Number(policy?.pagibig_rate) || 0.02;
  const maxPerSide = Number(policy?.pagibig_max_per_side) || 100;
  const minPerSide = Number(policy?.pagibig_min_per_side) || 0;
  const clamp = (v) => Math.min(Math.max(v, minPerSide), maxPerSide);
  if (monthlySalary <= 1500) return { employee: clamp(monthlySalary * 0.01), employer: clamp(monthlySalary * 0.02) };
  return { employee: clamp(monthlySalary * rate), employer: clamp(monthlySalary * rate) };
}

// 2026 PH Monthly Withholding Tax Table
function computeMonthlyWithholdingTax(monthlyTaxableIncome) {
  const income = Number(monthlyTaxableIncome) || 0;
  if (income <= 20833) return 0;
  if (income <= 33332) return (income - 20833) * 0.15;
  if (income <= 66666) return 1875 + (income - 33333) * 0.20;
  if (income <= 166666) return 8541.80 + (income - 66667) * 0.25;
  if (income <= 666666) return 33541.80 + (income - 166667) * 0.30;
  return 183541.80 + (income - 666667) * 0.35;
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function rebaseSummaryPay(summary, currentHourlyRate, payrollHours) {
  const hours = Number(payrollHours) || 0;
  const overtimeHours = Number(summary?.overtime_hours) || 0;
  const gross = hours * currentHourlyRate;
  const overtime = overtimeHours * currentHourlyRate * 1.25;

  if (!summary || !currentHourlyRate) {
    return {
      gross: Number(summary?.gross) || 0,
      regular: Number(summary?.regular_pay) || 0,
      overtime: Number(summary?.overtime_pay) || 0,
      holiday: Number(summary?.holiday_pay) || 0,
      leave: Number(summary?.leave_pay) || 0,
      latesDeduction: Number(summary?.lates_deduction) || 0,
    };
  }

  return {
    gross,
    regular: gross,
    overtime,
    holiday: Number(summary.holiday_pay) || 0,
    leave: Number(summary.leave_pay) || 0,
    latesDeduction: ((Number(summary.late_minutes) || 0) / 60) * currentHourlyRate,
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(operation, attempts = 12) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      if (!message.includes('429') && !message.toLowerCase().includes('rate limit')) throw error;
      // Exponential backoff with jitter, capped at ~15s, so colliding runs back off instead of dying.
      const backoff = Math.min(15000, 1000 * Math.pow(1.6, i)) + Math.floor(Math.random() * 500);
      await wait(backoff);
    }
  }
  throw lastError;
}

async function bulkCreateInChunks(entity, records, size = 25, onProgress = null) {
  for (let i = 0; i < records.length; i += size) {
    await withRetry(() => entity.bulkCreate(records.slice(i, i + size)));
    if (onProgress) await onProgress(Math.min(i + size, records.length));
    await wait(300);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { payroll_run_id, reconcile = false } = body;
    if (!payroll_run_id) return Response.json({ error: 'payroll_run_id required' }, { status: 400 });
    globalThis.__activePayrollRunId = payroll_run_id;

    const runs = await withRetry(() => base44.asServiceRole.entities.PayrollRun.filter({ id: payroll_run_id }));
    if (!runs.length) return Response.json({ error: 'Payroll run not found' }, { status: 404 });
    const run = runs[0];

    await withRetry(() => base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
      status: 'computing',
      compute_progress: 1,
      compute_processed: 0,
      compute_total: 0,
      compute_started_at: new Date().toISOString(),
      compute_completed_at: null,
    }));

    const allEmployees = await withRetry(() => base44.asServiceRole.entities.AirtableEmployeeRecord.list('-updated_date', 5000));
    await wait(600);

    let paySummaries = await withRetry(() => base44.asServiceRole.entities.AttendancePaySummary.filter({ period_start: run.period_start, period_end: run.period_end }, '-created_date', 5000));
    await wait(600);

    // Reconcile the period when explicitly requested, or automatically when no saved summaries
    // exist yet (first-ever compute of this period). We avoid reconciling on every recompute
    // because reconcile makes many DB calls and, chained with compute, can trip the rate limiter
    // (429) and leave the run stuck. Recompute reads the already-saved AttendancePaySummary records.
    // Non-fatal: if reconcile fails, fall back to whatever summaries already exist.
    if (reconcile || paySummaries.length === 0) {
      try {
        await withRetry(() => base44.functions.invoke('reconcilePeriod', {
          period_start: run.period_start,
          period_end: run.period_end,
          period_label: run.period_label,
        }));
        await wait(600);
        paySummaries = await withRetry(() => base44.asServiceRole.entities.AttendancePaySummary.filter({ period_start: run.period_start, period_end: run.period_end }, '-created_date', 5000));
        await wait(600);
      } catch (reconcileError) {
        console.warn('reconcilePeriod failed, using existing summaries:', reconcileError?.message);
      }
    }
    const govSettings = await withRetry(() => base44.asServiceRole.entities.EmployeeGovernmentSetting.list('-updated_date', 5000));
    await wait(400);
    const policyRows = await withRetry(() => base44.asServiceRole.entities.PayrollPolicy.filter({ key: 'default' }));
    const policy = policyRows[0] || {};
    await wait(200);
    const govByEmp = govSettings.reduce((m, g) => ({ ...m, [g.employee_id]: g }), {});
    await wait(400);
    // Active allowances assigned to employees (added automatically to final pay).
    const runBranchNorm = normalizeText(run.branch_name);
    const periodEndTime = run.period_end ? new Date(run.period_end).getTime() : null;
    const allEmployeeDeductions = await withRetry(() => base44.asServiceRole.entities.EmployeeDeduction.list('-updated_date', 5000));
    const allowanceRecords = allEmployeeDeductions.filter(r => r.kind === 'allowance');
    // Active ATD charges (cash advance, uniform, etc.) that reduce net pay.
    const deductionRecords = allEmployeeDeductions.filter(r => r.kind === 'deduction' && r.atd_status === 'active');

    // Shared targeting test: branch match, started by period end, and not already fully paid.
    const appliesToRun = (row) => {
      const rowBranch = normalizeText(row.branch);
      if (rowBranch && runBranchNorm && rowBranch !== runBranchNorm) return false;
      if (row.start_date && periodEndTime != null && new Date(row.start_date).getTime() > periodEndTime) return false;
      if (!row.recurring && Number(row.total_cutoffs) > 0 && Number(row.cutoffs_paid || 0) >= Number(row.total_cutoffs)) return false;
      return true;
    };

    // Employee IDs that qualify for an allowance in this run (used to also pull in consultants
    // who aren't part of the branch's regular employee list but still get paid an allowance).
    const allowanceEmployeeIds = new Set();
    const appliedDeductionRows = [];
    const allowanceByEmp = allowanceRecords.reduce((map, row) => {
      const amount = Number(row.amount_per_cutoff) || 0;
      if (amount <= 0 || !appliesToRun(row)) return map;
      map[row.employee_id] = (map[row.employee_id] || 0) + amount;
      allowanceEmployeeIds.add(row.employee_id);
      return map;
    }, {});

    const deductionByEmp = deductionRecords.reduce((map, row) => {
      const amount = Number(row.amount_per_cutoff) || 0;
      if (amount <= 0 || !appliesToRun(row)) return map;
      // Don't deduct more than the outstanding balance on a fixed-total charge.
      const total = Number(row.total_amount) || 0;
      const paid = (Number(row.cutoffs_paid) || 0) * amount;
      const applied = total > 0 ? Math.min(amount, Math.max(total - paid, 0)) : amount;
      if (applied <= 0) return map;
      map[row.employee_id] = (map[row.employee_id] || 0) + applied;
      appliedDeductionRows.push({ id: row.id, cutoffs_paid: (Number(row.cutoffs_paid) || 0) + 1, total_cutoffs: Number(row.total_cutoffs) || 0 });
      return map;
    }, {});
    const oldRecords = await withRetry(() => base44.asServiceRole.entities.PayrollRecord.filter({ payroll_run_id }, '-created_date', 5000));
    for (const record of oldRecords) {
      await withRetry(() => base44.asServiceRole.entities.PayrollRecord.delete(record.id));
      await wait(80);
    }

    // Statutory contributions (SSS/PhilHealth/Pag-IBIG) + withholding tax are deducted
    // only on the 2nd cutoff (2nd half of the month) — i.e. when the period starts on/after the 16th.
    // Parse the day directly from the YYYY-MM-DD string to avoid timezone shifting (new Date().getDate()
    // can roll "2026-04-01" back to day 31 of the previous month on some server timezones).
    const periodStartDay = run.period_start
      ? Number(String(run.period_start).split('-')[2]) || 1
      : 1;
    const isSecondCutoff = periodStartDay >= 16;

    const selectedBranch = normalizeText(run.branch_name);
    const employees = allEmployees.filter(employee => {
      // Always include employees who have a qualifying allowance for this run (e.g. consultants
      // not formally under this branch but who still receive an allowance paid through it).
      if (allowanceEmployeeIds.has(employee.id)) return true;
      if (!isActiveEmployee(employee)) return false;
      if (!selectedBranch) return true;
      const fields = getFields(employee);
      return normalizeText(employee.branch || fields.Branch || fields['Branch']) === selectedBranch;
    });
    await withRetry(() => base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
      compute_progress: 10,
      compute_processed: 0,
      compute_total: employees.length,
    }));

    const summaryByEmployeeId = paySummaries.reduce((map, summary) => {
      if (!map[summary.employee_id]) map[summary.employee_id] = summary;
      return map;
    }, {});
    const recordsToCreate = [];
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const emp of employees) {
      const fields = getFields(emp);
      const employeeName = getEmployeeName(emp);
      const employeeCode = getEmployeeCode(emp);
      const monthlySalary = parseMoney(fields['Basic Salary'] || fields['Monthly Salary'] || fields.Salary);
      const hourlyRate = monthlySalary > 0 ? monthlySalary / 26 / 8 : 0;
      const summary = summaryByEmployeeId[emp.id] || {};
      const totalHours = Number(summary.hours) || 0;
      const overtimeHours = Number(summary.overtime_hours) || 0;
      const totalLateMin = Number(summary.late_minutes) || 0;
      const totalUndertimeMin = 0;
      const daysWorked = Number(summary.days_worked) || (totalHours > 0 ? Math.ceil(totalHours / 8) : 0);
      const payrollHours = daysWorked * 8;
      const daysAbsent = Number(summary.days_absent) || 0;
      const currentPay = rebaseSummaryPay(summary, hourlyRate, payrollHours);
      const grossPay = currentPay.gross;
      const lateDeduction = currentPay.latesDeduction;
      const allowances = Number(allowanceByEmp[emp.id]) || 0;
      const otherDeductions = Number(deductionByEmp[emp.id]) || 0;
      const overtimePay = currentPay.overtime;
      const holidayPay = currentPay.holiday;
      const leavePay = currentPay.leave;
      const regularPay = currentPay.regular;
      const gov = govByEmp[emp.id] || {};
      const sssOn = gov.sss_enabled !== false;
      const phOn = gov.philhealth_enabled !== false;
      const piOn = gov.pagibig_enabled !== false;
      const sss = sssOn ? getSSSContribution(monthlySalary, policy) : { employee: 0, employer: 0 };
      const ph = phOn ? getPhilHealthContribution(monthlySalary, policy) : { employee: 0, employer: 0 };
      const pi = piOn ? getPagIBIGContribution(monthlySalary, policy) : { employee: 0, employer: 0 };
      // Full monthly contribution charged on the 2nd cutoff only; nothing on the 1st cutoff.
      const cutoffFactor = isSecondCutoff ? 1 : 0;
      const sssEE = sss.employee * cutoffFactor;
      const sssER = sss.employer * cutoffFactor;
      const phEE = ph.employee * cutoffFactor;
      const phER = ph.employer * cutoffFactor;
      const piEE = pi.employee * cutoffFactor;
      const piER = pi.employer * cutoffFactor;
      const monthlyTaxable = monthlySalary - sss.employee - ph.employee - pi.employee;
      const periodTax = computeMonthlyWithholdingTax(monthlyTaxable) * cutoffFactor;
      const totalDeductionsForEmp = sssEE + phEE + piEE + periodTax + lateDeduction + otherDeductions;
      const grossWithAllowance = grossPay + allowances;
      const netPay = grossWithAllowance - totalDeductionsForEmp;

      const payrollRecord = {
        payroll_run_id,
        employee_id: emp.id,
        airtable_record_id: emp.airtable_record_id,
        employee_code: employeeCode,
        employee_name: employeeName,
        is_held: false,
        basic_salary: money(monthlySalary),
        hourly_rate: money(hourlyRate),
        regular_pay: money(regularPay),
        days_worked: daysWorked,
        days_absent: daysAbsent,
        total_hours: money(payrollHours),
        late_minutes: totalLateMin,
        undertime_minutes: totalUndertimeMin,
        overtime_hours: money(overtimeHours),
        overtime_pay: money(overtimePay),
        holiday_pay: money(holidayPay),
        allowances: money(allowances),
        gross_pay: money(grossWithAllowance),
        sss_employee: money(sssEE),
        sss_employer: money(sssER),
        philhealth_employee: money(phEE),
        philhealth_employer: money(phER),
        pagibig_employee: money(piEE),
        pagibig_employer: money(piER),
        withholding_tax: money(periodTax),
        late_deduction: money(lateDeduction),
        absent_deduction: 0,
        other_deductions: money(otherDeductions),
        total_deductions: money(totalDeductionsForEmp),
        net_pay: money(netPay),
        status: 'computed',
      };

      recordsToCreate.push(payrollRecord);

      totalGross += grossWithAllowance;
      totalDeductions += totalDeductionsForEmp;
      totalNet += netPay;
    }

    await bulkCreateInChunks(base44.asServiceRole.entities.PayrollRecord, recordsToCreate, 25, async (processed) => {
      const progress = recordsToCreate.length ? 10 + Math.round((processed / recordsToCreate.length) * 85) : 95;
      await withRetry(() => base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
        compute_progress: progress,
        compute_processed: processed,
        compute_total: recordsToCreate.length,
      }));
    });

    // Advance progress on applied charges; mark completed when the last cutoff is paid.
    for (const row of appliedDeductionRows) {
      const update = { cutoffs_paid: row.cutoffs_paid };
      if (row.total_cutoffs > 0 && row.cutoffs_paid >= row.total_cutoffs) update.atd_status = 'completed';
      await withRetry(() => base44.asServiceRole.entities.EmployeeDeduction.update(row.id, update));
      await wait(80);
    }

    await withRetry(() => base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
      total_gross: money(totalGross),
      total_deductions: money(totalDeductions),
      total_net: money(totalNet),
      employee_count: employees.length,
      status: 'processing',
      notes: money(totalGross) <= 0
        ? 'Computed with ₱0.00 gross pay. Check approved schedules, attendance logs, and payroll reconciliation for this period/branch.'
        : '',
      compute_progress: 100,
      compute_processed: employees.length,
      compute_total: employees.length,
      compute_completed_at: new Date().toISOString(),
    }));

    return Response.json({
      success: true,
      employee_count: employees.length,
      total_gross: money(totalGross),
      total_net: money(totalNet),
      message: `Payroll computed from saved attendance pay summaries for ${employees.length} employees.`,
    });
  } catch (error) {
    // If the run died mid-compute (e.g. rate limits), reset it back to draft so the user can retry
    // instead of it being permanently stuck at "computing".
    const stuckId = globalThis.__activePayrollRunId;
    if (stuckId) {
      try {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.PayrollRun.update(stuckId, {
          status: 'draft',
          compute_progress: 0,
          notes: `Compute failed: ${error.message}. Please retry.`,
        });
      } catch (_resetError) {
        // best-effort reset; ignore secondary failures
      }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

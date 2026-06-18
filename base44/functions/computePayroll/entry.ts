import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
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
      const message = String(error?.message || '').toLowerCase();
      const retryable = message.includes('429') || message.includes('rate limit') || message.includes('connection')
        || message.includes('timeout') || message.includes('network') || message.includes('fetch') || message.includes('socket')
        || message.includes('502') || message.includes('503') || message.includes('504');
      if (!retryable) throw error;
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

// Payroll run now simply USES a reconciled result as its basis. All pay computation
// (earnings, statutory, tax, ATD charges, net) already happened — and may have been
// manually adjusted by HR — on the AttendancePaySummary records. This function just copies
// those rows into PayrollRecord entries for the chosen run. No recomputation.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { payroll_run_id, env } = body;
    const recEnv = env === 'test' ? 'test' : 'prod';
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

    // Pull the reconciled summaries for this run's period. These are the single source of truth.
    const paySummaries = await withRetry(() => base44.asServiceRole.entities.AttendancePaySummary.filter(
      { period_start: run.period_start, period_end: run.period_end }, '-created_date', 5000,
    ));
    await wait(400);

    if (!paySummaries.length) {
      await withRetry(() => base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
        status: 'draft',
        compute_progress: 0,
        notes: 'No reconciled result found for this period. Run reconciliation first, then choose it as the payroll basis.',
      }));
      return Response.json({ error: 'No reconciled summaries for this period. Reconcile first.' }, { status: 400 });
    }

    // Clear any previous records for this run before re-copying.
    const oldRecords = await withRetry(() => base44.asServiceRole.entities.PayrollRecord.filter({ payroll_run_id }, '-created_date', 5000));
    for (const record of oldRecords) {
      await withRetry(() => base44.asServiceRole.entities.PayrollRecord.delete(record.id));
      await wait(80);
    }

    await withRetry(() => base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
      compute_progress: 10,
      compute_processed: 0,
      compute_total: paySummaries.length,
    }));

    const recordsToCreate = [];
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const s of paySummaries) {
      const grossWithAllowance = money(Number(s.gross) || 0);
      const totalDed = money(Number(s.total_deductions) || 0);
      const net = money(Number(s.net_pay) != null ? s.net_pay : grossWithAllowance - totalDed);

      recordsToCreate.push({
        payroll_run_id,
        env: recEnv,
        employee_id: s.employee_id,
        airtable_record_id: s.airtable_record_id,
        employee_code: s.employee_code,
        employee_name: s.employee_name,
        is_held: false,
        basic_salary: money(s.basic_salary),
        hourly_rate: money(s.hourly_rate),
        regular_pay: money(s.regular_pay),
        days_worked: Number(s.days_worked) || 0,
        days_absent: Number(s.days_absent) || 0,
        total_hours: money(s.hours),
        late_minutes: Number(s.late_minutes) || 0,
        undertime_minutes: Number(s.undertime_minutes) || 0,
        overtime_hours: money(s.overtime_hours),
        overtime_pay: money(s.overtime_pay),
        holiday_pay: money(s.holiday_pay),
        allowances: money(s.allowances),
        gross_pay: grossWithAllowance,
        sss_employee: money(s.sss_employee),
        sss_employer: money(s.sss_employer),
        philhealth_employee: money(s.philhealth_employee),
        philhealth_employer: money(s.philhealth_employer),
        pagibig_employee: money(s.pagibig_employee),
        pagibig_employer: money(s.pagibig_employer),
        withholding_tax: money(s.withholding_tax),
        late_deduction: money(s.lates_deduction),
        absent_deduction: money(s.absent_deduction),
        other_deductions: money(s.other_deductions),
        total_deductions: totalDed,
        net_pay: net,
        status: 'computed',
      });

      totalGross += grossWithAllowance;
      totalDeductions += totalDed;
      totalNet += net;
    }

    await bulkCreateInChunks(base44.asServiceRole.entities.PayrollRecord, recordsToCreate, 25, async (processed) => {
      const progress = recordsToCreate.length ? 10 + Math.round((processed / recordsToCreate.length) * 85) : 95;
      await withRetry(() => base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
        compute_progress: progress,
        compute_processed: processed,
        compute_total: recordsToCreate.length,
      }));
    });

    await withRetry(() => base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
      total_gross: money(totalGross),
      total_deductions: money(totalDeductions),
      total_net: money(totalNet),
      employee_count: recordsToCreate.length,
      status: 'processing',
      notes: money(totalGross) <= 0
        ? 'Computed with ₱0.00 gross. Check the reconciled result for this period/branch.'
        : '',
      compute_progress: 100,
      compute_processed: recordsToCreate.length,
      compute_total: recordsToCreate.length,
      compute_completed_at: new Date().toISOString(),
    }));

    return Response.json({
      success: true,
      employee_count: recordsToCreate.length,
      total_gross: money(totalGross),
      total_deductions: money(totalDeductions),
      total_net: money(totalNet),
      message: `Payroll built from the reconciled result for ${recordsToCreate.length} employees.`,
    });
  } catch (error) {
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
        // best-effort reset
      }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});
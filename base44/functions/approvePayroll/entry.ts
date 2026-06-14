import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function money(value) { return Math.round(Number(value || 0) * 100) / 100; }

// Approve a payroll run AND permanently archive it (run + all its records) into
// ApprovedPayrollHistory so the data can never be lost via a later delete.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { payroll_run_id } = body;
    if (!payroll_run_id) return Response.json({ error: 'payroll_run_id required' }, { status: 400 });

    const runs = await base44.asServiceRole.entities.PayrollRun.filter({ id: payroll_run_id });
    if (!runs.length) return Response.json({ error: 'Payroll run not found' }, { status: 404 });
    const run = runs[0];

    const approvedDate = new Date().toISOString();

    // Mark the run approved first so the UI reflects it immediately.
    await base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
      status: 'approved',
      approved_by: user.email,
      approved_date: approvedDate,
    });

    // Pull every payroll record for this run to snapshot.
    const records = await base44.asServiceRole.entities.PayrollRecord.filter(
      { payroll_run_id }, '-created_date', 5000,
    );

    // Avoid duplicate history rows if approve is clicked twice.
    const existing = await base44.asServiceRole.entities.ApprovedPayrollHistory.filter({ payroll_run_id });
    const snapshot = {
      payroll_run_id,
      period_label: run.period_label,
      period_start: run.period_start,
      period_end: run.period_end,
      pay_date: run.pay_date || null,
      branch_id: run.branch_id || null,
      branch_name: run.branch_name || null,
      employee_count: records.length,
      total_gross: money(run.total_gross),
      total_deductions: money(run.total_deductions),
      total_net: money(run.total_net),
      approved_by: user.email,
      approved_date: approvedDate,
      run_snapshot: { ...run, status: 'approved', approved_by: user.email, approved_date: approvedDate },
      records_snapshot: records,
    };

    let history;
    if (existing.length) {
      history = await base44.asServiceRole.entities.ApprovedPayrollHistory.update(existing[0].id, snapshot);
    } else {
      history = await base44.asServiceRole.entities.ApprovedPayrollHistory.create(snapshot);
    }

    // For 13th month pay runs, flip every source saved record to 'released' so it can't
    // be picked again for a future 13th month generation.
    let released_count = 0;
    if (run.run_type === 'thirteenth_month' && Array.isArray(run.source_thirteenth_ids)) {
      for (const recordId of run.source_thirteenth_ids) {
        try {
          await base44.asServiceRole.entities.ThirteenthMonthRecord.update(recordId, {
            release_status: 'released',
            released_by: user.email,
            released_date: approvedDate,
          });
          released_count += 1;
        } catch (_e) { /* skip records that were deleted in the meantime */ }
      }
    }

    return Response.json({ success: true, history_id: history?.id || existing[0]?.id, employee_count: records.length, released_count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
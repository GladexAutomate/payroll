import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function money(value) { return Math.round(Number(value || 0) * 100) / 100; }

// Generate a 13th month payroll run from selected saved ThirteenthMonthRecord rows.
// Only records with release_status 'ready_to_release' are eligible — this prevents
// already-released 13th month pay from being duplicated into a new run.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { record_ids, pay_date } = body || {};
    if (!Array.isArray(record_ids) || record_ids.length === 0) {
      return Response.json({ error: 'record_ids required' }, { status: 400 });
    }

    // Load the selected saved 13th month records and keep only the ready-to-release ones.
    const allSaved = await base44.asServiceRole.entities.ThirteenthMonthRecord.filter(
      {}, '-created_date', 5000,
    );
    const selectedSet = new Set(record_ids);
    // Records saved before release_status existed have no value — treat missing as ready.
    const eligible = allSaved.filter(
      r => selectedSet.has(r.id) && (!r.release_status || r.release_status === 'ready_to_release'),
    );

    if (eligible.length === 0) {
      return Response.json({ error: 'No eligible (Ready to Release) 13th month records selected.' }, { status: 400 });
    }

    const year = eligible[0].year;
    const branchName = eligible[0].branch && eligible[0].branch !== 'all' ? eligible[0].branch : '';
    const periodStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31`;
    const totalNet = eligible.reduce((s, r) => s + Number(r.amount || 0), 0);

    // Create the payroll run (flagged as a 13th month run, linked to its source records).
    const run = await base44.asServiceRole.entities.PayrollRun.create({
      period_label: `13th Month Pay ${year}`,
      period_start: periodStart,
      period_end: periodEnd,
      pay_date: pay_date || null,
      run_type: 'thirteenth_month',
      source_thirteenth_ids: eligible.map(r => r.id),
      branch_id: branchName,
      branch_name: branchName,
      status: 'processing',
      employee_count: eligible.length,
      total_gross: money(totalNet),
      total_deductions: 0,
      total_net: money(totalNet),
      compute_progress: 100,
      compute_processed: eligible.length,
      compute_total: eligible.length,
      compute_completed_at: new Date().toISOString(),
    });

    // One PayrollRecord per employee — the 13th month amount is the net pay (no deductions).
    const records = eligible.map(r => ({
      payroll_run_id: run.id,
      employee_id: r.employee_id,
      employee_code: r.employee_code || '',
      employee_name: r.employee_name || '',
      basic_salary: money(r.basic_salary),
      regular_pay: money(r.amount),
      gross_pay: money(r.amount),
      allowances: 0,
      total_deductions: 0,
      net_pay: money(r.amount),
      status: 'computed',
    }));
    await base44.asServiceRole.entities.PayrollRecord.bulkCreate(records);

    return Response.json({ success: true, payroll_run_id: run.id, employee_count: eligible.length, total_net: money(totalNet) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
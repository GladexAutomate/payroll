import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(operation, attempts = 8) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      if (!message.includes('429') && !message.toLowerCase().includes('rate limit')) throw error;
      await wait(1500 * (i + 1));
    }
  }
  throw lastError;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { payroll_run_id } = await req.json();
    if (!payroll_run_id) return Response.json({ error: 'payroll_run_id required' }, { status: 400 });

    const runs = await withRetry(() => base44.asServiceRole.entities.PayrollRun.filter({ id: payroll_run_id }, '-created_date', 1));
    if (!runs.length) return Response.json({ error: 'Payroll run not found' }, { status: 404 });

    let deletedRecords = 0;
    let records = await withRetry(() => base44.asServiceRole.entities.PayrollRecord.filter({ payroll_run_id }, '-created_date', 100));
    while (records.length > 0) {
      for (const record of records) {
        await withRetry(() => base44.asServiceRole.entities.PayrollRecord.delete(record.id));
        deletedRecords += 1;
        await wait(120);
      }
      await wait(800);
      records = await withRetry(() => base44.asServiceRole.entities.PayrollRecord.filter({ payroll_run_id }, '-created_date', 100));
    }

    await withRetry(() => base44.asServiceRole.entities.PayrollRun.delete(payroll_run_id));

    return Response.json({ success: true, deleted_records: deletedRecords });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
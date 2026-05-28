import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetryUntilDone(operation) {
  while (true) {
    try {
      return await operation();
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('object not found')) return null;
      await wait(message.includes('429') || message.includes('rate limit') ? 3000 : 1500);
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { payroll_run_id } = await req.json();
    if (!payroll_run_id) return Response.json({ error: 'payroll_run_id required' }, { status: 400 });

    const runs = await withRetryUntilDone(() => base44.asServiceRole.entities.PayrollRun.filter({ id: payroll_run_id }, '-created_date', 1));
    if (!runs?.length) return Response.json({ success: true, deleted_records: 0, already_deleted: true });

    let deletedRecords = 0;
    let records = await withRetryUntilDone(() => base44.asServiceRole.entities.PayrollRecord.filter({ payroll_run_id }, '-created_date', 50));
    while (records?.length > 0) {
      for (const record of records) {
        await withRetryUntilDone(() => base44.asServiceRole.entities.PayrollRecord.delete(record.id));
        deletedRecords += 1;
        await wait(250);
      }
      await wait(1500);
      records = await withRetryUntilDone(() => base44.asServiceRole.entities.PayrollRecord.filter({ payroll_run_id }, '-created_date', 50));
    }

    await withRetryUntilDone(() => base44.asServiceRole.entities.PayrollRun.delete(payroll_run_id));

    return Response.json({ success: true, deleted_records: deletedRecords });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
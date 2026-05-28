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

    const runs = await withRetryUntilDone(() => base44.asServiceRole.entities.PayrollRun.list('-created_date', 5000));
    const activeRunIds = new Set((runs || []).map(run => run.id));
    let deletedRecords = 0;
    let checkedRecords = 0;

    while (true) {
      const records = await withRetryUntilDone(() => base44.asServiceRole.entities.PayrollRecord.list('-created_date', 100));
      const orphanRecords = (records || []).filter(record => record.payroll_run_id && !activeRunIds.has(record.payroll_run_id));
      checkedRecords += records?.length || 0;

      if (!orphanRecords.length) break;

      for (const record of orphanRecords) {
        await withRetryUntilDone(() => base44.asServiceRole.entities.PayrollRecord.delete(record.id));
        deletedRecords += 1;
        await wait(250);
      }
      await wait(1500);
    }

    return Response.json({ success: true, deleted_records: deletedRecords, checked_records: checkedRecords });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
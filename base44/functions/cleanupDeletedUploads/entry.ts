import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function deleteLogWithRetry(base44, logId) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await base44.asServiceRole.entities.AttendanceLog.delete(logId);
      return true;
    } catch (error) {
      const message = String(error?.message || error);
      if (message.includes('not found') || message.includes('404')) return true;
      if (attempt === 3) return false;
      await sleep(500 * attempt);
    }
  }
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const uploads = await base44.asServiceRole.entities.AttendanceUpload.filter({ status: 'deleting' }, 'delete_requested_at', 5);
    let uploadsProcessed = 0;
    let recordsDeleted = 0;
    const BATCH_SIZE = 50;
    const MAX_BATCHES_PER_RUN = 5;

    for (const upload of uploads) {
      let deletedForUpload = 0;

      for (let batchNumber = 0; batchNumber < MAX_BATCHES_PER_RUN; batchNumber++) {
        const batch = await base44.asServiceRole.entities.AttendanceLog.filter({ upload_id: upload.id }, '-date', BATCH_SIZE);
        if (batch.length === 0) break;

        for (const log of batch) {
          const deleted = await deleteLogWithRetry(base44, log.id);
          if (deleted) {
            recordsDeleted++;
            deletedForUpload++;
          }
        }

        if (batch.length < BATCH_SIZE) break;
        await sleep(300);
      }

      const remaining = await base44.asServiceRole.entities.AttendanceLog.filter({ upload_id: upload.id }, '-date', 1);
      if (remaining.length === 0) {
        await base44.asServiceRole.entities.AttendanceUpload.update(upload.id, {
          status: 'deleted',
          records_imported: 0,
          deleted_records_count: (upload.deleted_records_count || 0) + deletedForUpload,
          notes: 'Deleted in background',
        });
      } else if (deletedForUpload > 0) {
        await base44.asServiceRole.entities.AttendanceUpload.update(upload.id, {
          deleted_records_count: (upload.deleted_records_count || 0) + deletedForUpload,
          notes: 'Deletion still running in background',
        });
      }

      uploadsProcessed++;
    }

    return Response.json({ uploadsProcessed, recordsDeleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
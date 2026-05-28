import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const uploads = await base44.asServiceRole.entities.AttendanceUpload.filter({ status: 'deleting' }, 'delete_requested_at', 10);
    let uploadsProcessed = 0;
    let recordsDeleted = 0;

    for (const upload of uploads) {
      const result = await base44.asServiceRole.entities.AttendanceLog.deleteMany({ upload_id: upload.id });
      const deleted = result.deleted || 0;
      recordsDeleted += deleted;
      uploadsProcessed++;

      if (deleted === 0) {
        await base44.asServiceRole.entities.AttendanceUpload.update(upload.id, {
          status: 'deleted',
          records_imported: 0,
          deleted_records_count: upload.records_imported || 0,
          notes: 'Deleted in background',
        });
      }
    }

    return Response.json({ uploadsProcessed, recordsDeleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
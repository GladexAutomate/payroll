import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // ── DELETE UPLOAD mode ────────────────────────────────────────────────────
    if (body.action === 'delete') {
      const { uploadId } = body;
      if (!uploadId) return Response.json({ error: 'uploadId required' }, { status: 400 });

      // Fetch all logs linked to this upload (by upload_id field)
      let page = 0;
      const PAGE_SIZE = 200;
      let allLogs = [];
      while (true) {
        const batch = await base44.asServiceRole.entities.AttendanceLog.filter(
          { upload_id: uploadId }, '-date', PAGE_SIZE, page * PAGE_SIZE
        );
        allLogs = allLogs.concat(batch);
        if (batch.length < PAGE_SIZE) break;
        page++;
      }

      // Delete in batches of 5 with delay
      for (let i = 0; i < allLogs.length; i += 5) {
        await Promise.all(allLogs.slice(i, i + 5).map(l =>
          base44.asServiceRole.entities.AttendanceLog.delete(l.id)
        ));
        if (i + 5 < allLogs.length) await new Promise(r => setTimeout(r, 300));
      }

      await base44.asServiceRole.entities.AttendanceUpload.delete(uploadId);

      return Response.json({ deleted: allLogs.length });
    }

    // ── DELETE ALL (no upload_id filter) mode ─────────────────────────────────
    if (body.action === 'deleteAll') {
      // Paginate through ALL attendance logs and delete them all
      const PAGE_SIZE = 200;
      let totalDeleted = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities.AttendanceLog.list('-date', PAGE_SIZE);
        if (batch.length === 0) break;
        for (let i = 0; i < batch.length; i += 5) {
          await Promise.all(batch.slice(i, i + 5).map(l =>
            base44.asServiceRole.entities.AttendanceLog.delete(l.id)
          ));
          if (i + 5 < batch.length) await new Promise(r => setTimeout(r, 200));
        }
        totalDeleted += batch.length;
        if (batch.length < PAGE_SIZE) break;
        await new Promise(r => setTimeout(r, 300));
      }
      // Also clear all upload records
      const uploads = await base44.asServiceRole.entities.AttendanceUpload.list('-created_date', 500);
      for (const u of uploads) {
        await base44.asServiceRole.entities.AttendanceUpload.delete(u.id);
      }
      return Response.json({ deleted: totalDeleted });
    }

    // ── IMPORT mode ───────────────────────────────────────────────────────────
    const { records, filename, periodLabel, fileUrl } = body;

    if (!records || records.length === 0) {
      return Response.json({ saved: 0, updated: 0 });
    }

    // Save the upload record first so we have its ID to tag logs with
    const uploadRecord = await base44.asServiceRole.entities.AttendanceUpload.create({
      filename,
      file_url: fileUrl || '',
      period_label: periodLabel,
      records_imported: 0,
      status: 'processing',
      uploaded_by: user.email || '',
    });
    const uploadId = uploadRecord.id;

    // Fetch existing logs to detect updates vs creates
    const existingLogs = await base44.asServiceRole.entities.AttendanceLog.list('-date', 5000);
    const existingMap = {};
    for (const log of existingLogs) {
      existingMap[`${log.employee_id}|${log.date}`] = log;
    }

    const toCreate = [];
    const toUpdate = [];

    for (const rec of records) {
      const key = `${rec.employee_id}|${rec.date}`;
      const existing = existingMap[key];
      if (existing) {
        toUpdate.push({ id: existing.id, data: {
          time_in: rec.time_in || existing.time_in,
          time_out: rec.time_out || existing.time_out,
          total_hours: rec.total_hours || existing.total_hours,
          status: 'present',
          biometric_id: rec.biometric_id || existing.biometric_id,
          upload_id: uploadId,
        }});
      } else {
        toCreate.push({ ...rec, upload_id: uploadId });
      }
    }

    // Bulk create in batches of 50
    const BATCH = 50;
    let created = 0;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      await base44.asServiceRole.entities.AttendanceLog.bulkCreate(toCreate.slice(i, i + BATCH));
      created += Math.min(BATCH, toCreate.length - i);
      if (i + BATCH < toCreate.length) await new Promise(r => setTimeout(r, 500));
    }

    // Update in batches of 5
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += 5) {
      await Promise.all(toUpdate.slice(i, i + 5).map(u =>
        base44.asServiceRole.entities.AttendanceLog.update(u.id, u.data)
      ));
      updated += Math.min(5, toUpdate.length - i);
      if (i + 5 < toUpdate.length) await new Promise(r => setTimeout(r, 300));
    }

    const saved = created + updated;

    // Update the upload record with final counts
    await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
      records_imported: saved,
      status: saved > 0 ? 'success' : 'failed',
      notes: `${created} created, ${updated} updated`,
    });

    return Response.json({ saved, created, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
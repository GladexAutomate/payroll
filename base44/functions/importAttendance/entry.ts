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

      let page = 0;
      const PAGE_SIZE = 500;
      let allLogs = [];
      while (true) {
        const batch = await base44.asServiceRole.entities.AttendanceLog.filter(
          { upload_id: uploadId }, '-date', PAGE_SIZE, page * PAGE_SIZE
        );
        allLogs = allLogs.concat(batch);
        if (batch.length < PAGE_SIZE) break;
        page++;
      }

      // Delete in parallel batches of 20 — no artificial delays
      const BATCH = 20;
      for (let i = 0; i < allLogs.length; i += BATCH) {
        await Promise.all(allLogs.slice(i, i + BATCH).map(l =>
          base44.asServiceRole.entities.AttendanceLog.delete(l.id)
        ));
      }

      await base44.asServiceRole.entities.AttendanceUpload.delete(uploadId);
      return Response.json({ deleted: allLogs.length });
    }

    // ── CREATE UPLOAD RECORD (first call before chunking) ────────────────────
    if (body.action === 'createUpload') {
      const { filename, periodLabel, fileUrl } = body;
      const uploadRecord = await base44.asServiceRole.entities.AttendanceUpload.create({
        filename,
        file_url: fileUrl || '',
        period_label: periodLabel,
        records_imported: 0,
        status: 'processing',
        uploaded_by: user.email || '',
      });
      return Response.json({ uploadId: uploadRecord.id });
    }

    // ── IMPORT CHUNK mode ─────────────────────────────────────────────────────
    // Processes one chunk of 100 records at a time
    if (body.action === 'importChunk') {
      const { records, uploadId } = body;
      if (!records || records.length === 0) return Response.json({ saved: 0, created: 0, updated: 0 });

      // Fetch existing logs for the employee+date keys in this chunk only
      const dates = [...new Set(records.map(r => r.date))];
      const employeeIds = [...new Set(records.map(r => r.employee_id))];

      // Build existing map by fetching logs for dates in this chunk
      const existingMap = {};
      for (const date of dates) {
        const logs = await base44.asServiceRole.entities.AttendanceLog.filter({ date }, '-date', 500);
        for (const log of logs) {
          existingMap[`${log.employee_id}|${log.date}`] = log;
        }
        await new Promise(r => setTimeout(r, 100));
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
            raw_punches: rec.raw_punches || existing.raw_punches,
            total_hours: rec.total_hours || existing.total_hours,
            status: 'present',
            biometric_id: rec.biometric_id || existing.biometric_id,
            employee_name: rec.employee_name || existing.employee_name,
            upload_id: uploadId,
          }});
        } else {
          toCreate.push({ ...rec, upload_id: uploadId });
        }
      }

      // Bulk create in batches of 25
      let created = 0;
      const CREATE_BATCH = 25;
      for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
        await base44.asServiceRole.entities.AttendanceLog.bulkCreate(toCreate.slice(i, i + CREATE_BATCH));
        created += Math.min(CREATE_BATCH, toCreate.length - i);
        if (i + CREATE_BATCH < toCreate.length) await new Promise(r => setTimeout(r, 800));
      }

      // Update in batches of 5
      let updated = 0;
      for (let i = 0; i < toUpdate.length; i += 5) {
        await Promise.all(toUpdate.slice(i, i + 5).map(u =>
          base44.asServiceRole.entities.AttendanceLog.update(u.id, u.data)
        ));
        updated += Math.min(5, toUpdate.length - i);
        if (i + 5 < toUpdate.length) await new Promise(r => setTimeout(r, 600));
      }

      return Response.json({ saved: created + updated, created, updated });
    }

    // ── FINALIZE UPLOAD (last call after all chunks done) ────────────────────
    if (body.action === 'finalize') {
      const { uploadId, totalSaved, totalCreated, totalUpdated } = body;
      await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
        records_imported: totalSaved,
        status: totalSaved > 0 ? 'success' : 'failed',
        notes: `${totalCreated} created, ${totalUpdated} updated`,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
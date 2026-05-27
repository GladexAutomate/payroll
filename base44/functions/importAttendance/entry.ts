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
        await new Promise(r => setTimeout(r, 200));
      }

      // Delete one at a time with rate-limit retry, ignore "not found" errors
      let deleted = 0;
      for (const log of allLogs) {
        let attempts = 0;
        while (attempts < 5) {
          try {
            await base44.asServiceRole.entities.AttendanceLog.delete(log.id);
            deleted++;
            break;
          } catch (err) {
            const msg = String(err?.message || err);
            // Already gone — count as deleted and move on
            if (msg.includes('not found') || msg.includes('404')) {
              deleted++;
              break;
            }
            // Rate limit — back off and retry
            if (msg.includes('429') || msg.includes('Rate limit')) {
              attempts++;
              await new Promise(r => setTimeout(r, 1500 * attempts));
              continue;
            }
            // Other error — skip this one
            break;
          }
        }
        // Small throttle between deletes
        await new Promise(r => setTimeout(r, 150));
      }

      try {
        await base44.asServiceRole.entities.AttendanceUpload.delete(uploadId);
      } catch (_) { /* already deleted */ }
      return Response.json({ deleted });
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
    // Processes one chunk of records. Uses skipDuplicateCheck for fresh uploads
    // to skip the expensive existence-check phase entirely.
    if (body.action === 'importChunk') {
      const { records, uploadId, skipDuplicateCheck } = body;
      if (!records || records.length === 0) return Response.json({ saved: 0, created: 0, updated: 0 });

      const recordsWithUploadId = records.map(r => ({ ...r, upload_id: uploadId }));

      // Fast path: no duplicate check — just bulk create everything
      if (skipDuplicateCheck) {
        let created = 0;
        const CREATE_BATCH = 100;
        for (let i = 0; i < recordsWithUploadId.length; i += CREATE_BATCH) {
          const slice = recordsWithUploadId.slice(i, i + CREATE_BATCH);
          let attempts = 0;
          while (attempts < 5) {
            try {
              await base44.asServiceRole.entities.AttendanceLog.bulkCreate(slice);
              created += slice.length;
              break;
            } catch (err) {
              const msg = String(err?.message || err);
              if (msg.includes('429') || msg.includes('Rate limit')) {
                attempts++;
                await new Promise(r => setTimeout(r, 2000 * attempts));
                continue;
              }
              throw err;
            }
          }
          if (i + CREATE_BATCH < recordsWithUploadId.length) await new Promise(r => setTimeout(r, 300));
        }
        return Response.json({ saved: created, created, updated: 0 });
      }

      // Slow path (re-upload): check for duplicates by employee+date
      const dates = [...new Set(records.map(r => r.date))];
      const existingMap = {};
      for (const date of dates) {
        let attempts = 0;
        while (attempts < 5) {
          try {
            const logs = await base44.asServiceRole.entities.AttendanceLog.filter({ date }, '-date', 500);
            for (const log of logs) existingMap[`${log.employee_id}|${log.date}`] = log;
            break;
          } catch (err) {
            const msg = String(err?.message || err);
            if (msg.includes('429') || msg.includes('Rate limit')) {
              attempts++;
              await new Promise(r => setTimeout(r, 1500 * attempts));
              continue;
            }
            throw err;
          }
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const toCreate = [];
      const toUpdate = [];
      for (const rec of recordsWithUploadId) {
        const existing = existingMap[`${rec.employee_id}|${rec.date}`];
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
          toCreate.push(rec);
        }
      }

      let created = 0;
      const CREATE_BATCH = 100;
      for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
        const slice = toCreate.slice(i, i + CREATE_BATCH);
        let attempts = 0;
        while (attempts < 5) {
          try {
            await base44.asServiceRole.entities.AttendanceLog.bulkCreate(slice);
            created += slice.length;
            break;
          } catch (err) {
            const msg = String(err?.message || err);
            if (msg.includes('429') || msg.includes('Rate limit')) {
              attempts++;
              await new Promise(r => setTimeout(r, 2000 * attempts));
              continue;
            }
            throw err;
          }
        }
        if (i + CREATE_BATCH < toCreate.length) await new Promise(r => setTimeout(r, 400));
      }

      let updated = 0;
      for (const u of toUpdate) {
        let attempts = 0;
        while (attempts < 5) {
          try {
            await base44.asServiceRole.entities.AttendanceLog.update(u.id, u.data);
            updated++;
            break;
          } catch (err) {
            const msg = String(err?.message || err);
            if (msg.includes('429') || msg.includes('Rate limit')) {
              attempts++;
              await new Promise(r => setTimeout(r, 1500 * attempts));
              continue;
            }
            break;
          }
        }
        await new Promise(r => setTimeout(r, 200));
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
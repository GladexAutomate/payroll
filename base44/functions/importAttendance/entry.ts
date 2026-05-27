import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { records, filename, periodLabel, fileUrl } = await req.json();

    if (!records || records.length === 0) {
      return Response.json({ saved: 0, updated: 0 });
    }

    // Fetch existing logs for the dates in this upload (to detect updates vs creates)
    const allDates = [...new Set(records.map(r => r.date))];
    const allEmployeeIds = [...new Set(records.map(r => r.employee_id))];

    // Fetch existing logs in batches to avoid timeouts
    const existingLogs = await base44.asServiceRole.entities.AttendanceLog.list('-date', 5000);

    // Build lookup map
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
        }});
      } else {
        toCreate.push(rec);
      }
    }

    // Bulk create in batches of 100
    const BATCH = 100;
    let created = 0;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      await base44.asServiceRole.entities.AttendanceLog.bulkCreate(toCreate.slice(i, i + BATCH));
      created += Math.min(BATCH, toCreate.length - i);
    }

    // Update in batches of 20
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += 20) {
      await Promise.all(toUpdate.slice(i, i + 20).map(u =>
        base44.asServiceRole.entities.AttendanceLog.update(u.id, u.data)
      ));
      updated += Math.min(20, toUpdate.length - i);
    }

    const saved = created + updated;

    // Save upload record
    await base44.asServiceRole.entities.AttendanceUpload.create({
      filename,
      file_url: fileUrl || '',
      period_label: periodLabel,
      records_imported: saved,
      status: saved > 0 ? 'success' : 'failed',
      uploaded_by: user.email || '',
      notes: `${created} created, ${updated} updated`,
    });

    return Response.json({ saved, created, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
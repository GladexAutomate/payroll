import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

const MONTH_ABBR = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// Parse the whole Excel/CSV file into attendance records (server-side).
async function parseFile(base44, fileUrl, filename) {
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Could not download file (${resp.status})`);
  const arrayBuffer = await resp.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: false, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  if (rows.length < 2) throw new Error('File appears empty or has no data rows.');

  const rawHeaderRow = rows[0];
  const headerRow = rawHeaderRow.map(h => String(h).trim());

  const pcMatch = headerRow.findIndex(h => /person.?code/i.test(h) || /^no\.?$/i.test(h));
  const personCodeIdx = pcMatch !== -1 ? pcMatch : 0;
  const nMatch = headerRow.findIndex(h => /^name$/i.test(h));
  const nameIdx = nMatch !== -1 ? nMatch : 1;

  const dateCols = [];
  rawHeaderRow.forEach((h, i) => {
    if (i === personCodeIdx || i === nameIdx) return;
    const str = String(h).trim();
    const dMonMatch = str.match(/^(\d{1,2})-([A-Za-z]{3})$/);
    if (dMonMatch) {
      const day = parseInt(dMonMatch[1]);
      const monIdx = MONTH_ABBR.indexOf(dMonMatch[2].toLowerCase());
      if (monIdx >= 0) {
        dateCols.push({ idx: i, label: `${String(monIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
        return;
      }
    }
    if (/^\d{1,2}-\d{2}$/.test(str)) {
      dateCols.push({ idx: i, label: str });
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const parts = str.split('-');
      dateCols.push({ idx: i, label: `${parts[1]}-${parts[2]}` });
    } else if (typeof h === 'number' && h > 1 && h < 100000) {
      try {
        const d = XLSX.SSF.parse_date_code(h);
        if (d && d.m && d.d) {
          dateCols.push({ idx: i, label: `${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` });
        }
      } catch (_e) { /* ignore */ }
    }
  });

  if (dateCols.length === 0) {
    throw new Error(`No date columns found. Headers detected: "${headerRow.slice(0, 8).join('", "')}"`);
  }

  const yearMatch = filename.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  let periodLabel = `${year}`;
  const nameLC = filename.toLowerCase();
  const monthNameIdx = MONTH_ABBR.findIndex(m => nameLC.includes(m));
  if (monthNameIdx >= 0) {
    periodLabel = `${['January','February','March','April','May','June','July','August','September','October','November','December'][monthNameIdx]} ${year}`;
  }

  return { rows, headerRow, personCodeIdx, nameIdx, dateCols, year, periodLabel };
}

// Run the full import in the background for a given upload record.
async function runBackgroundImport(base44, uploadId) {
  const upload = await base44.asServiceRole.entities.AttendanceUpload.get(uploadId);
  if (!upload || !upload.file_url) {
    await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
      status: 'failed', error_message: 'Missing file. Please re-upload.', notes: 'Missing file',
    });
    return;
  }

  let parsed;
  try {
    parsed = await parseFile(base44, upload.file_url, upload.filename);
  } catch (err) {
    await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
      status: 'failed', error_message: String(err?.message || err), notes: 'Parse error',
    });
    return;
  }

  const { rows, personCodeIdx, nameIdx, dateCols, year, periodLabel } = parsed;

  // Map existing active employees
  const employees = await base44.asServiceRole.entities.Employee.filter({ status: 'active' });
  const byBioId = {};
  const byName = {};
  for (const emp of employees) {
    if (emp.biometric_id) byBioId[String(emp.biometric_id).trim()] = emp;
    if (emp.employee_id) byBioId[String(emp.employee_id).trim()] = emp;
    byName[`${emp.first_name} ${emp.last_name}`.toLowerCase().trim()] = emp;
  }

  // Auto-create missing employees
  const newEmployeesMap = {};
  for (let r = 1; r < rows.length; r++) {
    const code = String(rows[r][personCodeIdx] ?? '').trim();
    const rawName = String(rows[r][nameIdx] ?? '').trim();
    if (!code || !rawName) continue;
    if (!byBioId[code] && !byName[rawName.toLowerCase()] && !newEmployeesMap[code]) {
      newEmployeesMap[code] = { code, name: rawName };
    }
  }
  const createdEmployees = [];
  for (const ne of Object.values(newEmployeesMap)) {
    const parts = ne.name.split(/\s+/);
    const last_name = parts.length > 1 ? parts[parts.length - 1] : '';
    const first_name = parts.length > 1 ? parts.slice(0, -1).join(' ') : ne.name;
    try {
      const created = await base44.asServiceRole.entities.Employee.create({
        employee_id: ne.code, biometric_id: ne.code, first_name, last_name, status: 'active',
      });
      createdEmployees.push({ id: created.id, employee_id: ne.code, name: ne.name });
      byBioId[ne.code] = created;
      byName[ne.name.toLowerCase()] = created;
    } catch (_e) { /* skip duplicates */ }
  }

  // Build all records
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const code = String(row[personCodeIdx] ?? '').trim();
    const rawName = String(row[nameIdx] ?? '').trim();
    if (!code || !rawName) continue;
    const emp = byBioId[code] || byName[rawName.toLowerCase()];
    if (!emp) continue;

    for (const { idx, label } of dateCols) {
      const rawCell = row[idx];
      const cellVal = String(rawCell ?? '').trim();
      if (!cellVal || cellVal === '0') continue;

      let allPunches = [];
      if (typeof rawCell === 'number') {
        const totalMins = Math.round((rawCell % 1) * 24 * 60);
        allPunches = [`${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`];
      } else {
        allPunches = cellVal.match(/\d{1,2}:\d{2}/g) || [];
      }
      if (allPunches.length === 0) continue;

      const dateStr = `${year}-${label.padStart(5, '0')}`;
      const buildISO = (t) => t ? `${dateStr}T${t}:00` : null;
      const timeInISO = buildISO(allPunches[0]);
      const timeOutISO = allPunches.length > 1 ? buildISO(allPunches[allPunches.length - 1]) : null;
      const totalHours = timeInISO && timeOutISO
        ? Math.round((new Date(timeOutISO) - new Date(timeInISO)) / 36000) / 100 : 0;

      records.push({
        employee_id: emp.id, date: dateStr, time_in: timeInISO, time_out: timeOutISO,
        raw_punches: allPunches.map(t => buildISO(t)), total_hours: totalHours,
        employee_name: rawName, biometric_id: code, status: 'present', upload_id: uploadId,
      });
    }
  }

  if (records.length === 0) {
    await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
      status: 'success', progress: 100, records_imported: 0, total_rows: 0,
      new_employees: createdEmployees, period_label: periodLabel,
      notes: 'No time data found in date cells',
    });
    return;
  }

  await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
    total_rows: records.length, period_label: periodLabel, new_employees: createdEmployees,
  });

  // Build existing-record map for duplicate handling (scoped to this file's range)
  const dates = [...new Set(records.map(r => r.date))].sort();
  const minDate = dates[0], maxDate = dates[dates.length - 1];
  const empIds = [...new Set(records.map(r => r.employee_id))];
  const existingMap = {};
  const EMP_BATCH = 50;
  for (let e = 0; e < empIds.length; e += EMP_BATCH) {
    const empSlice = empIds.slice(e, e + EMP_BATCH);
    let skip = 0;
    while (true) {
      let logs = null;
      try {
        logs = await base44.asServiceRole.entities.AttendanceLog.filter(
          { employee_id: { $in: empSlice }, date: { $gte: minDate, $lte: maxDate } }, 'date', 500, skip
        );
      } catch (err) {
        if (String(err?.message || err).includes('429')) { await new Promise(r => setTimeout(r, 1500)); continue; }
        throw err;
      }
      if (!logs || logs.length === 0) break;
      for (const log of logs) existingMap[`${log.employee_id}|${log.date}`] = log;
      if (logs.length < 500) break;
      skip += 500;
    }
  }

  const toCreate = [];
  const toUpdate = [];
  for (const rec of records) {
    const existing = existingMap[`${rec.employee_id}|${rec.date}`];
    if (existing) {
      toUpdate.push({ id: existing.id, data: {
        time_in: rec.time_in || existing.time_in, time_out: rec.time_out || existing.time_out,
        raw_punches: rec.raw_punches || existing.raw_punches, total_hours: rec.total_hours || existing.total_hours,
        status: 'present', biometric_id: rec.biometric_id, employee_name: rec.employee_name, upload_id: uploadId,
      }});
    } else {
      toCreate.push(rec);
    }
  }

  let created = 0, updated = 0, processed = 0;
  const total = records.length;

  // Bulk create new records
  const CREATE_BATCH = 100;
  for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
    const slice = toCreate.slice(i, i + CREATE_BATCH);
    let attempts = 0;
    while (attempts < 5) {
      try { await base44.asServiceRole.entities.AttendanceLog.bulkCreate(slice); created += slice.length; break; }
      catch (err) {
        if (String(err?.message || err).includes('429')) { attempts++; await new Promise(r => setTimeout(r, 2000 * attempts)); continue; }
        throw err;
      }
    }
    processed += slice.length;
    await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
      processed_rows: processed, created_count: created, updated_count: updated,
      progress: Math.round((processed / total) * 100),
    });
  }

  // Update existing records
  for (const u of toUpdate) {
    let attempts = 0;
    while (attempts < 5) {
      try { await base44.asServiceRole.entities.AttendanceLog.update(u.id, u.data); updated++; break; }
      catch (err) {
        if (String(err?.message || err).includes('429')) { attempts++; await new Promise(r => setTimeout(r, 1500 * attempts)); continue; }
        break;
      }
    }
    processed++;
    if (processed % 25 === 0 || processed === total) {
      await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
        processed_rows: processed, created_count: created, updated_count: updated,
        progress: Math.round((processed / total) * 100),
      });
    }
  }

  await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
    status: 'success', progress: 100, records_imported: created + updated,
    processed_rows: total, created_count: created, updated_count: updated,
    notes: `${created} created, ${updated} updated`,
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // ── DELETE UPLOAD mode ──────────────────────────────────────────────────
    if (body.action === 'delete') {
      const { uploadId } = body;
      if (!uploadId) return Response.json({ error: 'uploadId required' }, { status: 400 });
      await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
        status: 'deleting', delete_requested_at: new Date().toISOString(), notes: 'Deletion queued in background',
      });
      return Response.json({ queued: true });
    }

    // ── START IMPORT: create record + kick off background import ────────────
    // Frontend uploads the file once, passes its URL here. We create the
    // upload record, start the heavy import WITHOUT awaiting it, and return
    // the uploadId immediately so the frontend can poll for progress.
    if (body.action === 'startImport') {
      const { filename, fileUrl } = body;
      if (!fileUrl) return Response.json({ error: 'fileUrl required' }, { status: 400 });

      const uploadRecord = await base44.asServiceRole.entities.AttendanceUpload.create({
        filename, file_url: fileUrl, records_imported: 0, status: 'processing',
        progress: 0, total_rows: 0, processed_rows: 0, uploaded_by: user.email || '',
      });

      // Fire-and-forget: run the full import in the background.
      runBackgroundImport(base44, uploadRecord.id).catch(async (err) => {
        try {
          await base44.asServiceRole.entities.AttendanceUpload.update(uploadRecord.id, {
            status: 'failed', error_message: String(err?.message || err), notes: 'Import error',
          });
        } catch (_e) { /* ignore */ }
      });

      return Response.json({ uploadId: uploadRecord.id });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

const MONTH_ABBR = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// How many attendance records to process per polling request. Kept small so a
// single batch never trips the per-app API rate limit, even when every record
// is an update (the most expensive path — updates are one API call each).
const BATCH_SIZE = 40;

const isRateLimit = (err) => {
  const msg = String(err?.message || err);
  return msg.includes('429') || msg.toLowerCase().includes('rate limit');
};

// Transient errors (rate limit OR a dropped/connection error) that are safe to retry.
const isTransient = (err) => {
  const msg = String(err?.message || err).toLowerCase();
  return isRateLimit(err) || msg.includes('connection') || msg.includes('network')
    || msg.includes('timeout') || msg.includes('fetch failed') || msg.includes('econnreset');
};

// Parse the whole Excel/CSV file into attendance records (server-side).
async function parseFile(fileUrl, filename) {
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

  return { rows, personCodeIdx, nameIdx, dateCols, year, periodLabel };
}

// Turn parsed rows into a flat list of attendance records (no DB calls).
function buildRecords(parsed, byBioId, byName, uploadId, recEnv) {
  const { rows, personCodeIdx, nameIdx, dateCols, year } = parsed;
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
        env: recEnv, employee_id: emp.id, date: dateStr, time_in: timeInISO, time_out: timeOutISO,
        raw_punches: allPunches.map(t => buildISO(t)), total_hours: totalHours,
        employee_name: rawName, biometric_id: code, status: 'present', upload_id: uploadId,
      });
    }
  }
  return records;
}

// Prepare the import: parse file, auto-create employees, set total_rows.
// Runs in a single request and finishes fast (no per-record DB writes).
async function prepareImport(base44, uploadId) {
  const upload = await base44.asServiceRole.entities.AttendanceUpload.get(uploadId);
  if (!upload || !upload.file_url) throw new Error('Missing file. Please re-upload.');
  const recEnv = upload.env || 'prod';

  console.log('[prepare] parsing file...');
  const parsed = await parseFile(upload.file_url, upload.filename);
  const { rows, personCodeIdx, nameIdx, periodLabel } = parsed;
  console.log('[prepare] parsed rows:', rows.length);

  console.log('[prepare] loading employees...');
  const employees = await base44.asServiceRole.entities.Employee.filter({ status: 'active' });
  console.log('[prepare] employees loaded:', employees.length);
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
        env: recEnv, employee_id: ne.code, biometric_id: ne.code, first_name, last_name, status: 'active',
      });
      createdEmployees.push({ id: created.id, employee_id: ne.code, name: ne.name });
      byBioId[ne.code] = created;
      byName[ne.name.toLowerCase()] = created;
    } catch (_e) { /* skip duplicates */ }
  }

  console.log('[prepare] auto-created employees:', createdEmployees.length);
  const records = buildRecords(parsed, byBioId, byName, uploadId, recEnv);
  console.log('[prepare] built records:', records.length);

  if (records.length === 0) {
    await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
      status: 'success', progress: 100, records_imported: 0, total_rows: 0, processed_rows: 0,
      new_employees: createdEmployees, period_label: periodLabel,
      notes: 'No time data found in date cells',
    });
    return { done: true, total: 0 };
  }

  // We do NOT delete old logs here — deleting thousands of records inline would
  // exceed the function's wall-clock limit. Instead we record the period range
  // and let the batched poll phase (processBatch) clear old logs a page at a
  // time before creating new ones, so every request stays short and reliable.
  const allDates = [...new Set(records.map(r => r.date))].sort();
  const minDate = allDates[0], maxDate = allDates[allDates.length - 1];

  console.log('[prepare] updating upload record, period', minDate, '->', maxDate);
  await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
    status: 'processing', total_rows: records.length, processed_rows: 0,
    created_count: 0, updated_count: 0, progress: 0,
    period_label: periodLabel, new_employees: createdEmployees,
    period_start: minDate, period_end: maxDate, delete_done: false,
  });
  console.log('[prepare] done');

  return { done: false, total: records.length };
}

// Process ONE create-only batch per request, driven by the frontend poll.
// Each batch just does a fast bulkCreate of new logs (tagged with upload_id)
// so every request stays short and nothing trips the function time limit.
// Re-uploading a period? Delete the old upload first from Upload History.
async function processBatch(base44, uploadId, offset) {
  const upload = await base44.asServiceRole.entities.AttendanceUpload.get(uploadId);
  if (!upload || !upload.file_url) throw new Error('Missing file. Please re-upload.');
  const recEnv = upload.env || 'prod';

  const parsed = await parseFile(upload.file_url, upload.filename);

  const employees = await base44.asServiceRole.entities.Employee.filter({ status: 'active' });
  const byBioId = {};
  const byName = {};
  for (const emp of employees) {
    if (emp.biometric_id) byBioId[String(emp.biometric_id).trim()] = emp;
    if (emp.employee_id) byBioId[String(emp.employee_id).trim()] = emp;
    byName[`${emp.first_name} ${emp.last_name}`.toLowerCase().trim()] = emp;
  }

  const allRecords = buildRecords(parsed, byBioId, byName, uploadId, recEnv);
  const total = allRecords.length;
  const batch = allRecords.slice(offset, offset + BATCH_SIZE);

  if (batch.length === 0) {
    const finalCount = upload.created_count || 0;
    const finalUpdated = upload.updated_count || 0;
    await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
      status: 'success', progress: 100, processed_rows: total,
      records_imported: finalCount + finalUpdated,
      notes: `${finalCount} created, ${finalUpdated} updated`,
    });
    return { done: true, phase: 'create', processed: total, total };
  }

  // Upsert: look up existing logs for this batch's employees+dates, then
  // update the ones that already exist and create only the new ones. Manually
  // edited logs are left untouched so HR corrections aren't overwritten.
  const empIds = [...new Set(batch.map(r => r.employee_id))];
  const dates = [...new Set(batch.map(r => r.date))];
  let existing = [];
  {
    let attempts = 0;
    while (attempts < 8) {
      try {
        existing = await base44.asServiceRole.entities.AttendanceLog.filter(
          { employee_id: { $in: empIds }, date: { $in: dates } }, '', 5000
        );
        break;
      } catch (err) {
        attempts++;
        if (isTransient(err) && attempts < 8) { await new Promise(r => setTimeout(r, 1500 * attempts)); continue; }
        throw err;
      }
    }
  }
  const existingMap = {};
  for (const log of existing) existingMap[`${log.employee_id}|${log.date}`] = log;

  const toCreate = [];
  const toUpdate = [];
  for (const rec of batch) {
    const match = existingMap[`${rec.employee_id}|${rec.date}`];
    if (match) {
      if (!match.is_manually_edited) toUpdate.push({ id: match.id, rec });
    } else {
      toCreate.push(rec);
    }
  }

  let created = 0;
  for (let i = 0; i < toCreate.length; i += 100) {
    const slice = toCreate.slice(i, i + 100);
    let attempts = 0;
    while (attempts < 8) {
      try { await base44.asServiceRole.entities.AttendanceLog.bulkCreate(slice); created += slice.length; break; }
      catch (err) {
        attempts++;
        if (isTransient(err) && attempts < 8) { await new Promise(r => setTimeout(r, 2000 * attempts)); continue; }
        throw err;
      }
    }
  }

  let updated = 0;
  for (const { id, rec } of toUpdate) {
    let attempts = 0;
    while (attempts < 8) {
      try { await base44.asServiceRole.entities.AttendanceLog.update(id, rec); updated += 1; break; }
      catch (err) {
        // Record vanished since we read it (concurrent delete) — create it fresh instead.
        if (String(err?.message || err).toLowerCase().includes('not found')) {
          try { await base44.asServiceRole.entities.AttendanceLog.create(rec); created += 1; } catch (_e) { /* skip */ }
          break;
        }
        attempts++;
        if (isTransient(err) && attempts < 8) { await new Promise(r => setTimeout(r, 1500 * attempts)); continue; }
        throw err;
      }
    }
    await new Promise(r => setTimeout(r, 60)); // gentle pacing to avoid rate limits
  }

  const newProcessed = Math.min(offset + batch.length, total);
  const newCreated = (upload.created_count || 0) + created;
  const newUpdated = (upload.updated_count || 0) + updated;
  const done = newProcessed >= total;

  await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
    processed_rows: newProcessed, created_count: newCreated, updated_count: newUpdated,
    progress: Math.round((newProcessed / total) * 100),
    ...(done ? {
      status: 'success', records_imported: newCreated + newUpdated,
      notes: `${newCreated} created, ${newUpdated} updated`,
    } : {}),
  });

  return { done, phase: 'create', nextOffset: newProcessed, processed: newProcessed, total };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const recEnv = String(body?.env || '').toLowerCase() === 'test' ? 'test' : 'prod';

    // ── DELETE UPLOAD mode ──────────────────────────────────────────────────
    if (body.action === 'delete') {
      const { uploadId } = body;
      if (!uploadId) return Response.json({ error: 'uploadId required' }, { status: 400 });
      await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
        status: 'deleting', delete_requested_at: new Date().toISOString(), notes: 'Deletion queued in background',
      });
      return Response.json({ queued: true });
    }

    // ── START IMPORT: create record + prepare (parse, auto-create employees) ─
    if (body.action === 'startImport') {
      const { filename, fileUrl } = body;
      if (!fileUrl) return Response.json({ error: 'fileUrl required' }, { status: 400 });

      const uploadRecord = await base44.asServiceRole.entities.AttendanceUpload.create({
        env: recEnv, filename, file_url: fileUrl, records_imported: 0, status: 'processing',
        progress: 0, total_rows: 0, processed_rows: 0, uploaded_by: user.email || '',
      });

      try {
        const prep = await prepareImport(base44, uploadRecord.id);
        return Response.json({ uploadId: uploadRecord.id, total: prep.total, done: prep.done });
      } catch (err) {
        await base44.asServiceRole.entities.AttendanceUpload.update(uploadRecord.id, {
          status: 'failed', error_message: String(err?.message || err), notes: 'Parse error',
        });
        return Response.json({ uploadId: uploadRecord.id, error: String(err?.message || err) });
      }
    }

    // ── PROCESS BATCH: import one slice of records, driven by frontend poll ──
    if (body.action === 'processBatch') {
      const { uploadId, offset } = body;
      if (!uploadId) return Response.json({ error: 'uploadId required' }, { status: 400 });
      try {
        const result = await processBatch(base44, uploadId, offset || 0);
        return Response.json(result);
      } catch (err) {
        await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
          status: 'failed', error_message: String(err?.message || err), notes: 'Import error',
        });
        return Response.json({ error: String(err?.message || err) }, { status: 200 });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
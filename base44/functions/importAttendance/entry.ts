import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

const MONTH_ABBR = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// Inner sub-batch size: how many records we look up + write per round. Kept modest
// so the existing-log lookup ($in employees × dates) stays well under the row limit
// and bulk writes never trip the per-app rate limit.
const BATCH_SIZE = 100;

// A single processBatch request keeps working through sub-batches until either the
// import is done or this wall-clock budget is reached, then it returns so the next
// poll can continue. This lets one request import hundreds/thousands of rows (far
// fewer browser→server round-trips) while still finishing before the function's
// hard time limit, so nothing is killed mid-flight.
const SOFT_TIME_BUDGET_MS = 25000;

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

// Retry a transient-failing operation with linear backoff.
async function withRetry(op, { max = 8, base = 1500 } = {}) {
  let attempt = 0;
  while (true) {
    try { return await op(); }
    catch (err) {
      attempt += 1;
      if (isTransient(err) && attempt < max) { await new Promise(r => setTimeout(r, base * attempt)); continue; }
      throw err;
    }
  }
}

// "HH:mm" -> minutes since midnight (null if unparseable).
const toMinutes = (t) => {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : null;
};
// "YYYY-MM-DD" -> the next calendar day, computed in UTC to avoid timezone drift.
const nextDateStr = (ds) => {
  const d = new Date(`${ds}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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
      const inTime = allPunches[0];
      const outTime = allPunches.length > 1 ? allPunches[allPunches.length - 1] : null;
      const inMin = toMinutes(inTime);
      // Overnight shift: any punch earlier in the clock than the first one belongs to
      // the NEXT calendar day (e.g. 22:00 → 06:00). Roll those forward so time_out is
      // always after time_in and worked-hours never come out negative. `date` stays the
      // shift's start day; downstream pay code reads the in/out span from these fields.
      const isoFor = (t) => {
        if (!t) return null;
        const day = (inMin != null && toMinutes(t) < inMin) ? nextDateStr(dateStr) : dateStr;
        return `${day}T${t}:00`;
      };
      const timeInISO = isoFor(inTime);
      const timeOutISO = isoFor(outTime);
      const totalHours = timeInISO && timeOutISO
        ? Math.round((new Date(timeOutISO) - new Date(timeInISO)) / 36000) / 100 : 0;

      records.push({
        env: recEnv, employee_id: emp.id, date: dateStr, time_in: timeInISO, time_out: timeOutISO,
        raw_punches: allPunches.map(t => isoFor(t)), total_hours: totalHours,
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
  const startedAt = Date.now();
  const upload = await base44.asServiceRole.entities.AttendanceUpload.get(uploadId);
  if (!upload || !upload.file_url) throw new Error('Missing file. Please re-upload.');
  const recEnv = upload.env || 'prod';

  // Parse the file, load employees, and build the full record set ONCE per request
  // (previously this ran on every 40-row batch — re-downloading + re-parsing the whole
  // workbook and reloading all employees hundreds of times for a single import).
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

  let cursor = Math.min(offset || 0, total);
  let created = 0;
  let updated = 0;

  // Keep importing sub-batches until the whole file is done or we hit the time budget,
  // so one poll processes far more than a single 40-row slice.
  while (cursor < total && (Date.now() - startedAt) < SOFT_TIME_BUDGET_MS) {
    const batch = allRecords.slice(cursor, cursor + BATCH_SIZE);
    if (batch.length === 0) break;

    // Upsert: look up existing logs for this batch's employees+dates, then update the
    // ones that already exist and create only the new ones. Manually edited logs are
    // left untouched so HR corrections aren't overwritten.
    const empIds = [...new Set(batch.map(r => r.employee_id))];
    const dates = [...new Set(batch.map(r => r.date))];
    const existing = await withRetry(() => base44.asServiceRole.entities.AttendanceLog.filter(
      { employee_id: { $in: empIds }, date: { $in: dates } }, '', 5000
    ));
    const existingMap = {};
    for (const log of existing) existingMap[`${log.employee_id}|${log.date}`] = log;

    const toCreate = [];
    const toUpdate = [];
    for (const rec of batch) {
      const match = existingMap[`${rec.employee_id}|${rec.date}`];
      if (match) { if (!match.is_manually_edited) toUpdate.push({ id: match.id, rec }); }
      else toCreate.push(rec);
    }

    for (let i = 0; i < toCreate.length; i += 100) {
      const slice = toCreate.slice(i, i + 100);
      await withRetry(() => base44.asServiceRole.entities.AttendanceLog.bulkCreate(slice), { base: 2000 });
      created += slice.length;
    }

    for (const { id, rec } of toUpdate) {
      try {
        await withRetry(() => base44.asServiceRole.entities.AttendanceLog.update(id, rec));
        updated += 1;
      } catch (err) {
        // Record vanished since we read it (concurrent delete) — create it fresh instead.
        if (String(err?.message || err).toLowerCase().includes('not found')) {
          try { await base44.asServiceRole.entities.AttendanceLog.create(rec); created += 1; } catch (_e) { /* skip */ }
        } else {
          throw err;
        }
      }
    }

    cursor += batch.length;
  }

  const newProcessed = Math.min(cursor, total);
  const newCreated = (upload.created_count || 0) + created;
  const newUpdated = (upload.updated_count || 0) + updated;
  const done = newProcessed >= total;

  await base44.asServiceRole.entities.AttendanceUpload.update(uploadId, {
    processed_rows: newProcessed, created_count: newCreated, updated_count: newUpdated,
    progress: total ? Math.round((newProcessed / total) * 100) : 100,
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
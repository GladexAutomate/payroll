import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MIRROR_ENTITY = 'AirtableEmployeeRecord';
const AIRTABLE_BASE_ID = 'appNRjLCu4uxT395V';
const AIRTABLE_TABLE_ID = 'tblAOjFrCv9R6fFKq';

// Airtable attachment columns we extract, and the mirror fields we store them on.
const ATTACHMENT_MAP = [
  { airtableField: 'CONTRACT', mirrorField: 'Contract Files' },
  { airtableField: 'ATD DOCUMENTS', mirrorField: 'ATD Files' },
];

// How many Airtable records to process per polling request. Each record can have
// several files to download + re-host, so we keep the batch small to stay fast.
const BATCH_SIZE = 15;

const clean = (value) => String(value || '').trim();

// Pull one page of Airtable records (just the two attachment fields + Employee Code).
async function fetchAirtablePage(apiKey, offset) {
  const params = new URLSearchParams();
  params.set('pageSize', '100');
  params.append('fields[]', 'Employee Code');
  params.append('fields[]', 'CONTRACT');
  params.append('fields[]', 'ATD DOCUMENTS');
  if (offset) params.set('offset', offset);

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?${params.toString()}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Airtable error ${resp.status}: ${text.slice(0, 300)}`);
  }
  return await resp.json();
}

// Load every Airtable record into a flat list once (paginated). Returns an array
// of { employeeCode, attachments: { 'Contract Files': [...], 'ATD Files': [...] } }.
async function loadAllAirtableRecords(apiKey) {
  const out = [];
  let offset = null;
  do {
    const page = await fetchAirtablePage(apiKey, offset);
    for (const rec of page.records || []) {
      const employeeCode = clean(rec.fields?.['Employee Code']);
      if (!employeeCode) continue;
      const attachments = {};
      for (const { airtableField, mirrorField } of ATTACHMENT_MAP) {
        const arr = Array.isArray(rec.fields?.[airtableField]) ? rec.fields[airtableField] : [];
        attachments[mirrorField] = arr.map((a) => ({ filename: a.filename, url: a.url, type: a.type, size: a.size }));
      }
      out.push({ employeeCode, attachments });
    }
    offset = page.offset || null;
  } while (offset);
  return out;
}

// Download a file from Airtable's (temporary) URL and re-host it permanently in Base44.
async function rehostFile(base44, apiKey, file) {
  const resp = await fetch(file.url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!resp.ok) throw new Error(`download failed (${resp.status})`);
  const blob = await resp.blob();
  const named = new File([blob], file.filename || 'document', { type: file.type || blob.type || 'application/octet-stream' });
  const uploaded = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: named });
  const fileUri = uploaded?.file_uri || uploaded?.data?.file_uri;
  if (!fileUri) throw new Error('upload returned no file_uri');
  return { filename: file.filename || 'document', file_uri: fileUri, type: file.type || '' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── SIGN URL: create a temporary download link for a stored private file ────
    // Any authenticated user can fetch a download link for an already-stored file.
    if (action === 'signUrl') {
      const { fileUri } = body;
      if (!fileUri) return Response.json({ error: 'fileUri required' }, { status: 400 });
      const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri });
      const signedUrl = signed?.signed_url || signed?.data?.signed_url;
      return Response.json({ signedUrl });
    }

    // Extraction (prepare / processBatch) writes data and is admin-only.
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const apiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!apiKey) return Response.json({ error: 'AIRTABLE_API_KEY not set' }, { status: 500 });

    // ── PREPARE: count how many Airtable records have files to extract ──────────
    if (action === 'prepare') {
      const records = await loadAllAirtableRecords(apiKey);
      const withFiles = records.filter((r) =>
        ATTACHMENT_MAP.some(({ mirrorField }) => (r.attachments[mirrorField] || []).length > 0)
      );
      return Response.json({ total: withFiles.length, totalRecords: records.length });
    }

    // ── PROCESS BATCH: re-host files for one slice of records, save to mirror ───
    if (action === 'processBatch') {
      const offset = body.offset || 0;

      const records = await loadAllAirtableRecords(apiKey);
      const withFiles = records.filter((r) =>
        ATTACHMENT_MAP.some(({ mirrorField }) => (r.attachments[mirrorField] || []).length > 0)
      );
      const total = withFiles.length;
      const batch = withFiles.slice(offset, offset + BATCH_SIZE);

      if (batch.length === 0) {
        return Response.json({ done: true, processed: total, total });
      }

      // Map Employee Code -> mirror record (one lookup for the whole batch).
      const codes = batch.map((r) => r.employeeCode);
      const mirrorRecords = await base44.asServiceRole.entities[MIRROR_ENTITY].filter(
        { employee_code: { $in: codes } }, '', 1000
      );
      const mirrorByCode = {};
      for (const m of mirrorRecords) mirrorByCode[clean(m.employee_code)] = m;

      let processed = 0;
      let filesStored = 0;
      let skipped = 0;

      for (const rec of batch) {
        const mirror = mirrorByCode[rec.employeeCode];
        if (!mirror) { skipped += 1; continue; }

        const newFields = { ...(mirror.fields || {}) };
        for (const { mirrorField } of ATTACHMENT_MAP) {
          const files = rec.attachments[mirrorField] || [];
          const rehosted = [];
          for (const f of files) {
            try {
              rehosted.push(await rehostFile(base44, apiKey, f));
              filesStored += 1;
            } catch (_e) { /* skip a single bad file, keep going */ }
          }
          if (rehosted.length) newFields[mirrorField] = rehosted;
        }
        await base44.asServiceRole.entities[MIRROR_ENTITY].update(mirror.id, { fields: newFields });
        processed += 1;
      }

      const newProcessed = Math.min(offset + batch.length, total);
      const done = newProcessed >= total;
      return Response.json({
        done, nextOffset: newProcessed, processed: newProcessed, total,
        batchStored: filesStored, batchSkipped: skipped,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
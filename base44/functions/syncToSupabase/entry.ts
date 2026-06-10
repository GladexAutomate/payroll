import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Every Base44 entity that should be mirrored into Supabase.
// Supabase table name = lowercase of the entity name (create matching tables with an `id` text primary key + jsonb columns).
const ENTITIES = [
  'User',
  'AirtableEmployeeRecord',
  'Employee',
  'EmployeeAirtableMatch',
  'Company',
  'Branch',
  'Department',
  'SubDepartment',
  'Team',
  'AttendanceLog',
  'AttendanceUpload',
  'AttendancePaySummary',
  'AttendanceProposal',
  'ApprovedSchedule',
  'ShiftTemplate',
  'ShiftAssignment',
  'LeaveRequest',
  'OvertimeRequest',
  'OffsetRequest',
  'EmployeeDeduction',
  'EmployeeGovernmentSetting',
  'PayrollRun',
  'PayrollRecord',
  'PayrollPolicy',
  'RoleHierarchy',
  'RolePagePermission',
  'UserSignature',
  'BranchBranding',
  'HolidayCalendar',
  'BiometricSyncLog',
  'AppSettings',
];

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(operation, attempts = 6) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      const msg = String(error?.message || '');
      if (!msg.includes('429') && !msg.toLowerCase().includes('rate limit')) throw error;
      await wait(Math.min(10000, 800 * Math.pow(1.6, i)));
    }
  }
  throw lastError;
}

function tableName(entity) { return entity.toLowerCase(); }

// Upsert a batch of rows into a Supabase table via the REST API (on_conflict=id).
function restBase(rawUrl) {
  // Accept either the project URL (https://xxx.supabase.co) or the full REST URL,
  // and always produce ".../rest/v1".
  let base = String(rawUrl || '').replace(/\/+$/, '');
  if (!/\/rest\/v1$/.test(base)) base = `${base}/rest/v1`;
  return base;
}

async function upsertBatch(baseUrl, key, table, rows) {
  const url = `${restBase(baseUrl)}/${table}?on_conflict=id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert ${table} failed (${res.status}): ${text}`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow either an authenticated admin (manual run) or the scheduled automation (no user).
    let user = null;
    try { user = await base44.auth.me(); } catch (_e) { user = null; }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SECRET_KEY = Deno.env.get('SUPABASE_SECRET_KEY');
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return Response.json({ error: 'Supabase secrets not configured' }, { status: 500 });
    }

    const summary = {};
    for (const entity of ENTITIES) {
      const sdkEntity = base44.asServiceRole.entities[entity];
      if (!sdkEntity) { summary[entity] = 'skipped (no entity)'; continue; }

      let synced = 0;
      try {
        // Page through all records to avoid loading huge datasets at once.
        let skip = 0;
        const pageSize = 200;
        for (;;) {
          const page = await withRetry(() => sdkEntity.list('-updated_date', pageSize, skip));
          if (!page || page.length === 0) break;
          // Wrap each record as { id, data } to match the JSONB table schema, then upsert in chunks of 100.
          const rows = page.map((r) => ({ id: r.id, data: r }));
          for (let i = 0; i < rows.length; i += 100) {
            const chunk = rows.slice(i, i + 100);
            await upsertBatch(SUPABASE_URL, SUPABASE_SECRET_KEY, tableName(entity), chunk);
          }
          synced += page.length;
          skip += page.length;
          if (page.length < pageSize) break;
          await wait(150);
        }
        summary[entity] = synced;
      } catch (error) {
        summary[entity] = `error: ${error.message}`;
      }
      await wait(120);
    }

    return Response.json({ success: true, synced_at: new Date().toISOString(), summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
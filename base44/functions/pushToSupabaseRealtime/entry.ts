import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Real-time single-record push to Supabase PRODUCTION.
//
// Triggered by entity automations on create/update/delete. It upserts (or deletes)
// exactly one record into the matching Supabase production table so changes made in
// the published app appear in Supabase immediately, instead of waiting for the
// 5-minute incremental sweep (syncToSupabase).
//
// Only PRODUCTION data is pushed. Records explicitly tagged env:'test' (editor
// preview) are ignored so preview edits never reach the production Supabase branch.

function restBase(rawUrl) {
  let base = String(rawUrl || '').replace(/\/+$/, '');
  if (!/\/rest\/v1$/.test(base)) base = `${base}/rest/v1`;
  return base;
}

function tableName(entity) { return String(entity || '').toLowerCase(); }

async function ensureTable(baseUrl, key, table) {
  const sql = `create table if not exists public.${table} (id text primary key, data jsonb);`;
  const res = await fetch(`${restBase(baseUrl)}/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`ensureTable ${table} failed (${res.status}): ${await res.text()}`);
}

async function upsertRow(baseUrl, key, table, row) {
  const url = `${restBase(baseUrl)}/${table}?on_conflict=id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([row]),
  });
  if (!res.ok) throw new Error(`Supabase upsert ${table} failed (${res.status}): ${await res.text()}`);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try { payload = await req.json(); } catch (_e) { /* no body */ }

    // Entity-automation payload shape: { event: { type, entity_name, entity_id }, data, ... }
    const event = payload.event || {};
    const entity = event.entity_name || payload.entity_name;
    const entityId = event.entity_id || payload.entity_id;
    const eventType = event.type || payload.type;
    if (!entity || !entityId) {
      return Response.json({ error: 'entity_name and entity_id are required' }, { status: 400 });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SECRET_KEY = Deno.env.get('SUPABASE_SECRET_KEY');
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return Response.json({ error: 'Supabase production secrets not configured' }, { status: 500 });
    }

    // Deletes are intentionally NOT propagated to Supabase — only update/upsert.
    if (eventType === 'delete') {
      return Response.json({ success: true, skipped: 'delete not propagated', entity, id: entityId });
    }

    const table = tableName(entity);
    try { await ensureTable(SUPABASE_URL, SUPABASE_SECRET_KEY, table); } catch (_e) { /* table likely exists */ }

    // Re-read the record fresh (payload may be omitted when too large) to push the
    // truly-persisted value.
    let record = payload.data;
    if (!record || payload.payload_too_large) {
      record = await base44.asServiceRole.entities[entity].get(entityId).catch(() => null);
    }
    if (!record) {
      // Record vanished between trigger and run — nothing to upsert (deletes are not propagated).
      return Response.json({ success: true, skipped: 'record not found', entity, id: entityId });
    }

    // Never push editor-preview data to production Supabase.
    if (record.env === 'test') {
      return Response.json({ success: true, skipped: 'test-env record', entity, id: entityId });
    }

    await upsertRow(SUPABASE_URL, SUPABASE_SECRET_KEY, table, { id: record.id, data: record });
    return Response.json({ success: true, action: 'upsert', entity, id: record.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
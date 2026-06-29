import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Scheduled cleanup for the Schedule Requests page.
//
// Any AttendanceProposal that was REJECTED at least ARCHIVE_AFTER_DAYS days ago is:
//   1. saved into Supabase (a dedicated `attendanceproposal_archive` table), then
//   2. deleted from the Base44 database — which also clears it from the
//      Schedule Requests page view (the page lists straight from Base44).
//
// Wire this to a daily Base44 scheduled automation (Builder → Automations →
// "Run a function on a schedule"). It also runs on demand for an authenticated admin.

const ARCHIVE_AFTER_DAYS = 3;
const ARCHIVE_TABLE = 'attendanceproposal_archive';
const PAGE_SIZE = 200;
const MAX_PER_RUN = 1000; // safety cap so a single run can't loop forever

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

// Accept either the project URL (https://xxx.supabase.co) or the full REST URL.
function restBase(rawUrl) {
  let base = String(rawUrl || '').replace(/\/+$/, '');
  if (!/\/rest\/v1$/.test(base)) base = `${base}/rest/v1`;
  return base;
}

// Create the archive table on the fly. Mirrors the {id, data} shape used by the
// rest of the Supabase mirror, plus an archived_at stamp. Requires the one-time
// `exec_sql` RPC that syncToSupabase already relies on; non-fatal if absent.
async function ensureArchiveTable(baseUrl, key) {
  const sql = `create table if not exists public.${ARCHIVE_TABLE} (`
    + `id text primary key, data jsonb, rejected_at timestamptz, archived_at timestamptz default now());`;
  const res = await fetch(`${restBase(baseUrl)}/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ensureArchiveTable failed (${res.status}): ${text}`);
  }
}

async function upsertArchiveRows(baseUrl, key, rows) {
  const url = `${restBase(baseUrl)}/${ARCHIVE_TABLE}?on_conflict=id`;
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
    throw new Error(`Supabase archive upsert failed (${res.status}): ${text}`);
  }
}

// Effective rejection time: when it was reviewed, else last update, else creation.
function rejectionTime(proposal) {
  const raw = proposal.reviewed_date || proposal.updated_date || proposal.created_date;
  const ms = Date.parse(raw || '');
  return Number.isNaN(ms) ? null : ms;
}

Deno.serve(async (req) => {
  const startedAt = new Date();
  try {
    const base44 = createClientFromRequest(req);

    // Allow an authenticated admin (manual run) or the scheduled automation (no user).
    let user = null;
    try { user = await base44.auth.me(); } catch (_e) { user = null; }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Branch selection mirrors syncToSupabase: preview frontend targets the TEST
    // branch; published app + scheduled automation default to PRODUCTION.
    let appEnv = 'published';
    try {
      const body = await req.json();
      if (String(body?.env || '').toLowerCase() === 'preview') appEnv = 'preview';
    } catch (_e) { /* no body */ }

    const useTest = appEnv === 'preview'
      && Deno.env.get('SUPABASE_TEST_URL')
      && Deno.env.get('SUPABASE_TEST_SECRET_KEY');

    const SUPABASE_URL = useTest ? Deno.env.get('SUPABASE_TEST_URL') : Deno.env.get('SUPABASE_URL');
    const SUPABASE_SECRET_KEY = useTest ? Deno.env.get('SUPABASE_TEST_SECRET_KEY') : Deno.env.get('SUPABASE_SECRET_KEY');
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return Response.json({ error: 'Supabase secrets not configured' }, { status: 500 });
    }

    const cutoffMs = startedAt.getTime() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;

    // Make sure the archive table exists before we delete anything from Base44.
    await ensureArchiveTable(SUPABASE_URL, SUPABASE_SECRET_KEY);

    let archived = 0;
    let scanned = 0;
    let errorCount = 0;
    let skip = 0;

    // Page through rejected proposals oldest-first so the most-stale get archived
    // first and we stay under MAX_PER_RUN on busy days.
    while (archived < MAX_PER_RUN) {
      const page = await withRetry(() =>
        base44.asServiceRole.entities.AttendanceProposal.filter(
          { status: 'rejected' }, 'reviewed_date', PAGE_SIZE, skip,
        ),
      );
      if (!page || page.length === 0) break;
      scanned += page.length;

      // Only archive ones old enough; keep recent rejections visible on the page.
      const due = page.filter((p) => {
        const t = rejectionTime(p);
        return t !== null && t <= cutoffMs;
      });

      for (const proposal of due) {
        if (archived >= MAX_PER_RUN) break;
        try {
          const t = rejectionTime(proposal);
          await upsertArchiveRows(SUPABASE_URL, SUPABASE_SECRET_KEY, [{
            id: proposal.id,
            data: proposal,
            rejected_at: t ? new Date(t).toISOString() : null,
            archived_at: startedAt.toISOString(),
          }]);
          // Supabase row is safely persisted — now clear it from Base44 (and the page).
          await withRetry(() => base44.asServiceRole.entities.AttendanceProposal.delete(proposal.id));
          archived += 1;
        } catch (error) {
          errorCount += 1;
          console.error(`archive ${proposal.id} failed: ${error?.message || error}`);
        }
        await wait(80);
      }

      // Records we scanned but left in place (too recent) won't disappear, so advance
      // the cursor past them to avoid re-scanning the same head every loop.
      skip += page.length - due.length;
      if (page.length < PAGE_SIZE) break;
      await wait(120);
    }

    const finishedAt = new Date();
    const status = errorCount > 0 ? (archived > 0 ? 'partial' : 'error') : 'success';
    await base44.asServiceRole.entities.SyncLog.create({
      kind: 'archive',
      status,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt - startedAt,
      total_synced: archived,
      error_count: errorCount,
      summary: { AttendanceProposal: archived, scanned },
      message: `Archived ${archived} rejected schedule request(s) ≥${ARCHIVE_AFTER_DAYS} days old → ${useTest ? 'TEST' : 'PRODUCTION'} (${ARCHIVE_TABLE})`,
    }).catch(() => {});

    return Response.json({
      success: true,
      target: useTest ? 'test' : 'production',
      archived,
      scanned,
      error_count: errorCount,
      cutoff: new Date(cutoffMs).toISOString(),
    });
  } catch (error) {
    const finishedAt = new Date();
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.SyncLog.create({
        kind: 'archive', status: 'error',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt - startedAt, message: error.message,
      });
    } catch (_e) { /* ignore */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

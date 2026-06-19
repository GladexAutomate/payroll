import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const status = e?.response?.status || e?.status;
      if (status === 429 || status >= 500) { await sleep(800 * (i + 1)); continue; }
      throw e;
    }
  }
  throw lastErr;
}

// Remove every ApprovedSchedule row that was plotted from a given proposal.
// Used when a previously-approved proposal is later rejected.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { proposalId, env } = await req.json();
    if (!proposalId) return Response.json({ error: 'proposalId is required' }, { status: 400 });
    // Environment isolation: only unplot rows from the caller's environment
    // ('test' in preview, 'prod'/legacy untagged when published), so a reject
    // in one world never wipes the other world's plotted schedule.
    const recEnv = env === 'test' ? 'test' : 'prod';
    const envClause = recEnv === 'test' ? { env: 'test' } : { env: { $in: ['prod', null] } };

    const existing = await withRetry(() => base44.asServiceRole.entities.ApprovedSchedule.filter({ ...envClause, source_proposal_id: proposalId }, '-created_date', 5000));
    let removed = 0;
    for (const rec of existing) {
      await withRetry(() => base44.asServiceRole.entities.ApprovedSchedule.delete(rec.id));
      removed += 1;
    }

    return Response.json({ success: true, removed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
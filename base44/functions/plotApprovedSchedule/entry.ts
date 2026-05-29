import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { proposalId } = await req.json();
    if (!proposalId) return Response.json({ error: 'proposalId is required' }, { status: 400 });

    const proposal = await withRetry(() => base44.asServiceRole.entities.AttendanceProposal.get(proposalId));
    if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });

    const employees = proposal.employees || [];
    const assignments = proposal.assignments || {};

    // Remove any prior plot from this same proposal (re-approval safe)
    const existing = await withRetry(() => base44.asServiceRole.entities.ApprovedSchedule.filter({ source_proposal_id: proposalId }, '-created_date', 5000));
    for (const rec of existing) {
      await withRetry(() => base44.asServiceRole.entities.ApprovedSchedule.delete(rec.id));
    }

    const rows = [];
    employees.forEach(emp => {
      const dayMap = assignments[emp.id] || {};
      Object.entries(dayMap).forEach(([date, schedule_type]) => {
        if (!schedule_type || schedule_type === 'none') return;
        rows.push({
          employee_id: emp.id,
          employee_name: emp.name,
          department: emp.department || '',
          date,
          schedule_type,
          source_proposal_id: proposalId,
        });
      });
    });

    // Bulk create in chunks
    let saved = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      await withRetry(() => base44.asServiceRole.entities.ApprovedSchedule.bulkCreate(chunk));
      saved += chunk.length;
    }

    return Response.json({ success: true, plotted: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
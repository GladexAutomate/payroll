import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { proposalId, eventType } = body;
    if (!proposalId || !['approved', 'rejected'].includes(eventType)) {
      return Response.json({ error: 'proposalId and valid eventType are required' }, { status: 400 });
    }

    const proposals = await base44.entities.AttendanceProposal.list('-created_date', 200);
    const proposal = proposals.find(item => item.id === proposalId);
    if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });

    const settingsRecords = await base44.entities.AppSettings.filter({ key: 'schedule_webhooks' }, '-created_date', 1);
    const settings = settingsRecords[0] || {};
    const url = eventType === 'approved' ? settings.approved_schedule_webhook : settings.rejected_schedule_webhook;

    if (!url) return Response.json({ skipped: true, message: 'Webhook URL not set yet' });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, proposal, triggeredBy: user.email, triggeredAt: new Date().toISOString() }),
    });

    return Response.json({ sent: response.ok, status: response.status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
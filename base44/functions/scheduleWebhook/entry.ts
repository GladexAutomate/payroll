import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const formatDate = (dateString, options) => new Intl.DateTimeFormat('en-US', options).format(new Date(`${dateString}T00:00:00`));

const getDates = (start, end) => {
  const dates = [];
  const current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (current <= last) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const scheduleStyles = {
  opener: { label: 'Opener', sub: 'Onsite', bg: '#3b82f6', color: '#fff' },
  closer: { label: 'Closer', sub: 'Onsite', bg: '#f97316', color: '#fff' },
  off: { label: 'OFF', sub: '', bg: '#ef4444', color: '#fff' },
  wfh: { label: 'WFH', sub: '', bg: '#8b5cf6', color: '#fff' },
  paid_vl: { label: 'Paid VL', sub: '', bg: '#10b981', color: '#fff' },
  none: { label: 'No Sched', sub: '', bg: '#e5e7eb', color: '#374151' },
};

const buildPeriodLabel = (start, end) => {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
  if (sameMonth) return `${formatDate(start, { month: 'long' })} ${startDate.getDate()} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
  return `${formatDate(start, { month: 'long', day: 'numeric', year: 'numeric' })} - ${formatDate(end, { month: 'long', day: 'numeric', year: 'numeric' })}`;
};

const buildScheduleTable = (proposal) => {
  const dates = getDates(proposal.period_start, proposal.period_end);
  const headerCells = dates.map(date => `
      <th style="padding: 8px; border: 1px solid #ddd; font-size: 11px; background-color: #f5f5f5; text-align: center; min-width: 50px;">
        ${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}<br/><span style="font-weight: normal; color: #666;">${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)}</span>
      </th>
    `).join('');

  const rows = (proposal.employees || []).map(employee => {
    const cells = dates.map(date => {
      const dateKey = date.toISOString().slice(0, 10);
      const type = proposal.assignments?.[employee.id]?.[dateKey] || 'none';
      const style = scheduleStyles[type] || scheduleStyles.none;
      return `
          <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px; background-color: ${style.bg}; color: ${style.color};">
            ${style.label}
            ${style.sub ? `<div style="font-size: 9px;">${style.sub}</div>` : ''}
          </td>
        `;
    }).join('');
    return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f9f9f9;">${employee.name || 'Employee'}</td>
          ${cells}
        </tr>
      `;
  }).join('');

  return `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
            <thead>
              <tr style="background-color: #003d82; color: white;">
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left; min-width: 120px;">Employee</th>
                ${headerCells}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
};

const buildEmailBody = (proposal, eventType, rejectionNote, periodLabel) => {
  const isRejected = eventType === 'rejected';
  const title = isRejected ? 'Schedule Proposal Rejected' : 'Schedule Proposal Approved';
  const color = isRejected ? '#e74c3c' : '#16a34a';
  const detailText = isRejected ? 'has been rejected' : 'has been approved';
  const rejectionBlock = isRejected ? `
          <div style="background-color: #fdeaea; border-left: 4px solid #e74c3c; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #e74c3c;">Rejection Reason:</p>
            <p style="margin: 8px 0 0 0; color: #c0392b;">${rejectionNote || 'N/A'}</p>
          </div>` : '';

  return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: ${color};">${title}</h2>
          <p>The schedule proposal for <strong>${proposal.team_name || ''}</strong> ${detailText}.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

          <h3 style="color: #333; margin-bottom: 10px;">Proposal Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px; font-weight: bold; background-color: #f5f5f5;">Team:</td><td style="padding: 8px;">${proposal.team_name || ''}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; background-color: #f5f5f5;">Company:</td><td style="padding: 8px;">${proposal.company_name || ''}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; background-color: #f5f5f5;">Branch:</td><td style="padding: 8px;">${proposal.branch_name || ''}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; background-color: #f5f5f5;">Department:</td><td style="padding: 8px;">${proposal.department_name || ''}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; background-color: #f5f5f5;">Period:</td><td style="padding: 8px;">${periodLabel}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; background-color: #f5f5f5;">Leader:</td><td style="padding: 8px;">${proposal.leader_name || ''} (${proposal.leader_email || ''})</td></tr>
          </table>

          <h3 style="color: #333; margin-bottom: 10px;">Attendance Schedule</h3>
          ${buildScheduleTable(proposal)}
          ${rejectionBlock}
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated notification. Please do not reply to this email.</p>
        </body>
      </html>
    `;
};

const buildWebhookPayload = (proposal, eventType, rejectionNote) => {
  const periodLabel = buildPeriodLabel(proposal.period_start, proposal.period_end);
  const event = eventType === 'approved' ? 'attendance_approved' : 'attendance_rejected';
  return {
    event,
    proposal_id: proposal.id,
    team_name: proposal.team_name || '',
    leader_name: proposal.leader_name || '',
    leader_email: proposal.leader_email || '',
    company_name: proposal.company_name || '',
    branch_name: proposal.branch_name || '',
    department_name: proposal.department_name || '',
    period_label: periodLabel,
    period_start: proposal.period_start,
    period_end: proposal.period_end,
    email_subject: `Schedule ${eventType === 'approved' ? 'Approved' : 'Rejected'} — ${proposal.team_name || ''} (${proposal.period_start}–${proposal.period_end})`,
    rejection_note: eventType === 'rejected' ? (rejectionNote || 'N/A') : '',
    email_body: buildEmailBody(proposal, eventType, rejectionNote, periodLabel),
  };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { proposalId, eventType, rejectionNote } = body;
    if (!proposalId || !['approved', 'rejected'].includes(eventType)) {
      return Response.json({ error: 'proposalId and valid eventType are required' }, { status: 400 });
    }

    const proposals = await base44.entities.AttendanceProposal.list('-created_date', 200);
    const proposal = proposals.find(item => item.id === proposalId);
    if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });

    const settingsRecords = await base44.entities.AppSettings.filter({ key: 'schedule_webhooks' }, '-created_date', 1);
    const settings = settingsRecords[0] || {};
    const url = eventType === 'approved' ? settings.approved_schedule_webhook : settings.rejected_schedule_webhook;

    const payload = buildWebhookPayload(proposal, eventType, rejectionNote);

    if (!url) return Response.json({ skipped: true, message: 'Webhook URL not set yet', payload });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return Response.json({ sent: response.ok, status: response.status, payload });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
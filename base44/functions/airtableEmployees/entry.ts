import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BASE_ID = 'appNRjLCu4uxT395V';
const TABLE_ID = 'tblAOjFrCv9R6fFKq';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!apiKey) return Response.json({ error: 'AIRTABLE_API_KEY not set' }, { status: 500 });

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = await req.json();
    const { action } = body;

    // ── LIST: paginated fetch of records ──────────────────────────────────────
    if (action === 'list') {
      const { pageSize = 50, offset } = body;
      const params = new URLSearchParams({ pageSize: String(Math.min(pageSize, 100)) });
      if (offset) params.set('offset', offset);

      const res = await fetch(`${AIRTABLE_URL}?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });

      return Response.json({
        records: data.records || [],
        offset: data.offset || null,
      });
    }

    // ── CREATE: add a new record ──────────────────────────────────────────────
    if (action === 'create') {
      const { fields } = body;
      const res = await fetch(AIRTABLE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields, typecast: true }),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });
      return Response.json({ record: data });
    }

    // ── UPDATE: patch a record by ID ──────────────────────────────────────────
    if (action === 'update') {
      const { recordId, fields } = body;
      if (!recordId) return Response.json({ error: 'recordId required' }, { status: 400 });
      const res = await fetch(`${AIRTABLE_URL}/${recordId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields, typecast: true }),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });
      return Response.json({ record: data });
    }

    // ── DELETE: remove a record by ID ─────────────────────────────────────────
    if (action === 'delete') {
      const { recordId } = body;
      if (!recordId) return Response.json({ error: 'recordId required' }, { status: 400 });
      const res = await fetch(`${AIRTABLE_URL}/${recordId}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });
      return Response.json({ deleted: true, id: data.id });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
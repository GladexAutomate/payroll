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

    // ── SCHEMA: fetch field metadata to detect computed/read-only fields ──────
    if (action === 'schema') {
      const res = await fetch(
        `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
        { headers }
      );
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });
      const table = (data.tables || []).find(t => t.id === TABLE_ID);
      if (!table) return Response.json({ error: 'Table not found in schema' }, { status: 404 });

      // Airtable computed/read-only field types
      const COMPUTED_TYPES = new Set([
        'formula', 'rollup', 'lookup', 'count',
        'autoNumber', 'createdTime', 'lastModifiedTime',
        'createdBy', 'lastModifiedBy', 'externalSyncSource',
        'aiText', 'button',
      ]);
      const computedFields = (table.fields || [])
        .filter(f => COMPUTED_TYPES.has(f.type))
        .map(f => f.name);

      // Extract field metadata for selects, multi-selects, and other relevant types
      const fieldsMeta = {};
      for (const f of (table.fields || [])) {
        if (f.type === 'singleSelect' || f.type === 'multipleSelects') {
          fieldsMeta[f.name] = {
            type: f.type,
            choices: (f.options?.choices || []).map(c => ({
              name: c.name,
              color: c.color || null,
            })),
          };
        } else {
          fieldsMeta[f.name] = { type: f.type };
        }
      }

      return Response.json({ computedFields, fieldsMeta });
    }

    // ── LIST: paginated fetch of records ──────────────────────────────────────
    if (action === 'list') {
      const { pageSize = 50, offset, search } = body;
      const params = new URLSearchParams({ pageSize: String(Math.min(pageSize, 100)) });
      if (offset) params.set('offset', offset);

      // If search query is provided, build a server-side filterByFormula that
      // does a case-insensitive substring match across common text fields.
      if (search && search.trim()) {
        const safe = search.trim().replace(/"/g, '\\"').toLowerCase();
        const fieldsToSearch = [
          'Full Name', 'First Name', 'Last Name', 'Middle Name',
          'Employee Code ID', 'Email', 'Business email',
          'Department', 'Department Role', 'Job Title', 'Status',
          'Work Location', 'Mobile Number', 'SSS Number',
          'PhilHealth Number', 'Pag-IBIG Number', 'Address',
        ];
        const formula = `OR(${fieldsToSearch.map(f =>
          `FIND("${safe}", LOWER({${f}}&""))`
        ).join(',')})`;
        params.set('filterByFormula', formula);
      }

      const res = await fetch(`${AIRTABLE_URL}?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });

      return Response.json({
        records: data.records || [],
        offset: data.offset || null,
      });
    }

    // ── DEPARTMENTS: unique department names from Airtable employee records ───
    if (action === 'departments') {
      const counts = new Map();
      let offset = null;

      do {
        const params = new URLSearchParams({ pageSize: '100' });
        params.append('fields[]', 'Department');
        if (offset) params.set('offset', offset);

        const res = await fetch(`${AIRTABLE_URL}?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });

        for (const record of (data.records || [])) {
          const value = record.fields?.Department;
          const names = Array.isArray(value) ? value : [value];
          for (const rawName of names) {
            const name = String(rawName || '').trim();
            if (!name) continue;
            counts.set(name, (counts.get(name) || 0) + 1);
          }
        }
        offset = data.offset || null;
      } while (offset);

      const departments = Array.from(counts.entries())
        .map(([name, employee_count]) => ({
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name,
          code: name.split(/\s+/).map(word => word[0]).join('').slice(0, 5).toUpperCase(),
          employee_count,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return Response.json({ departments });
    }

    // ── DEPARTMENT ROLES: unique Department Role values from Airtable ─────────
    if (action === 'departmentRoles') {
      const counts = new Map();
      let offset = null;

      do {
        const params = new URLSearchParams({ pageSize: '100' });
        params.append('fields[]', 'Department Role');
        if (offset) params.set('offset', offset);

        const res = await fetch(`${AIRTABLE_URL}?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });

        for (const record of (data.records || [])) {
          const value = record.fields?.['Department Role'];
          const names = Array.isArray(value) ? value : [value];
          for (const rawName of names) {
            const name = String(rawName || '').trim();
            if (!name) continue;
            counts.set(name, (counts.get(name) || 0) + 1);
          }
        }
        offset = data.offset || null;
      } while (offset);

      const departmentRoles = Array.from(counts.entries())
        .map(([name, employee_count]) => ({
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name,
          employee_count,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return Response.json({ departmentRoles });
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

    // ── RENAME FIELD: change a column's name ──────────────────────────────────
    if (action === 'renameField') {
      const { fieldId, fieldName, newName } = body;
      if (!newName) return Response.json({ error: 'newName required' }, { status: 400 });

      // Resolve fieldId if only name is provided
      let resolvedId = fieldId;
      if (!resolvedId) {
        const metaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, { headers });
        const metaData = await metaRes.json();
        if (!metaRes.ok) return Response.json({ error: metaData.error?.message || 'Schema fetch failed' }, { status: metaRes.status });
        const table = (metaData.tables || []).find(t => t.id === TABLE_ID);
        const field = (table?.fields || []).find(f => f.name === fieldName);
        if (!field) return Response.json({ error: `Field "${fieldName}" not found` }, { status: 404 });
        resolvedId = field.id;
      }

      const res = await fetch(
        `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields/${resolvedId}`,
        { method: 'PATCH', headers, body: JSON.stringify({ name: newName }) }
      );
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Rename failed', details: data }, { status: res.status });
      return Response.json({ field: data });
    }

    // ── CREATE FIELD: add a new column ────────────────────────────────────────
    if (action === 'createField') {
      const { name, type = 'singleLineText', options } = body;
      const cleanName = String(name || '').trim();
      if (!cleanName) return Response.json({ error: 'Column name is required' }, { status: 400 });

      const metaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, { headers });
      const metaData = await metaRes.json();
      if (!metaRes.ok) return Response.json({ error: metaData.error?.message || 'Schema check failed', details: metaData }, { status: metaRes.status });
      const table = (metaData.tables || []).find(t => t.id === TABLE_ID);
      const existingField = (table?.fields || []).find(f => f.name.toLowerCase() === cleanName.toLowerCase());
      if (existingField) {
        return Response.json({ error: `A column named "${existingField.name}" already exists in Airtable.` }, { status: 409 });
      }

      const payload = { name: cleanName, type };
      if (options) payload.options = options;

      const res = await fetch(
        `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields`,
        { method: 'POST', headers, body: JSON.stringify(payload) }
      );
      const data = await res.json();
      if (!res.ok) {
        return Response.json({
          error: data.error?.message || data.error?.type || 'Create field failed. Please check that your Airtable token has schema write permission.',
          details: data
        }, { status: res.status });
      }
      return Response.json({ field: data });
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
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MIRROR_ENTITY = 'AirtableEmployeeRecord';

const slug = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
const normalizeField = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const valueText = (value) => Array.isArray(value) ? value.join(', ') : String(value || '');
const sanitizeForStorage = (value) => {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : String(value);
  if (Array.isArray(value)) return value.map(sanitizeForStorage);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeForStorage(item)]));
  }
  return value;
};
const getStatus = (record) => String(record?.fields?.Status || record?.Status || '').trim().toLowerCase();
const isActive = (record) => getStatus(record) === 'active';
const isNotResigned = (record) => getStatus(record) !== 'resigned';
const clean = (value) => String(value || '').trim();
const digitsOnly = (value) => clean(value).replace(/[^0-9]/g, '');
const employeeInitials = (fields) => {
  const first = clean(fields['First Name']);
  const middle = clean(fields['Middle Name']);
  const last = clean(fields['Last Name']);
  const names = [first, middle, last].filter(Boolean);
  if (!names.length && fields['Full Name']) return clean(fields['Full Name']).split(/\s+/).map(part => part[0]).join('').toUpperCase();
  return names.map(name => name[0]).join('').toUpperCase();
};
const generatedPassword = (fields) => `${employeeInitials(fields)}${digitsOnly(fields['Date Hired']).slice(0, 8)}`;
const normalizeName = (value) => String(value || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const nameTokens = (value) => normalizeName(value).split(' ').filter(Boolean);
const smartNameKey = (value) => {
  const tokens = nameTokens(value);
  if (tokens.length <= 2) return tokens.join(' ');
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
};
const editDistance = (a, b) => {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let edits = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; }
    else if (++edits > 2) return edits;
    else if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + (i < a.length || j < b.length ? 1 : 0);
};
const firstLastTokensMatch = (nameA, nameB) => {
  const a = nameTokens(nameA);
  const b = nameTokens(nameB);
  if (!a.length || !b.length) return false;
  const firstClose = a[0] === b[0] || editDistance(a[0], b[0]) <= 1;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  const lastClose = lastA === lastB || editDistance(lastA, lastB) <= 2;
  return firstClose && lastClose;
};
const localEmployeeName = (employee) => [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ');
const airtableRecordName = (record) => {
  const fields = record.fields || {};
  return fields['Full Name'] || [fields['First Name'], fields['Middle Name'], fields['Last Name']].filter(Boolean).join(' ');
};
const namesMatch = (employee, record) => {
  const localName = localEmployeeName(employee);
  const remoteName = airtableRecordName(record);
  return normalizeName(localName) === normalizeName(remoteName) || smartNameKey(localName) === smartNameKey(remoteName) || firstLastTokensMatch(localName, remoteName);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { action } = body;

    // Backend-only actions can run unattended (e.g. the consolidation orchestrator via
    // service role). All other actions require an authenticated user.
    // publicOnboard is reachable without login (new-hire self-service form link).
    const BACKEND_ACTIONS = new Set(['syncFromAirtable', 'syncStatus', 'publicOnboard']);
    let user = null;
    try { user = await base44.auth.me(); } catch (_e) { user = null; }
    if (!user && !BACKEND_ACTIONS.has(action)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Employee records are a single shared roster backed by the real Airtable base —
    // there is no test/prod copy. To avoid accidentally changing live employee data
    // (and the real Airtable base) while experimenting in the editor, block all write
    // actions when the request comes from the in-editor PREVIEW (env: 'test').
    // Reads stay open everywhere.
    const WRITE_ACTIONS = new Set([
      'create', 'update', 'delete', 'reassignEmployeeCategory', 'updateCompanyForBranch',
      'renameField', 'createField', 'syncBiometricsMatch', 'autoMatchBiometrics',
    ]);
    if (body.env === 'test' && WRITE_ACTIONS.has(action)) {
      return Response.json({
        error: 'Editing employee records is disabled in the preview. Open the published app to add, edit, or delete records.',
      }, { status: 403 });
    }

    // Standalone org-field resolver: pick canonical column names from existing records' keys,
    // so we don't depend on Airtable's schema endpoint.
    const getOrgFields = async () => {
      const sample = await listMirrorRecords(200);
      const keys = new Set();
      for (const r of sample) for (const k of Object.keys(r.fields || {})) keys.add(k);
      const allKeys = Array.from(keys);
      const pick = (candidates) => allKeys.find(name => candidates.map(normalizeField).includes(normalizeField(name))) || candidates[0];
      return {
        company: pick(['Company', 'COMPANY']),
        branch: pick(['Branch', 'BRANCH']),
        department: pick(['Department', 'DEPARTMENT']),
        role: pick(['Department Role', 'DEPARTMENT ROLE']),
        team: pick(['Team', 'TEAM']),
        fullName: pick(['Full Name', 'FULL NAME']),
        employeeCode: pick(['Employee Code ID', 'Employee Code', 'EMPLOYEE CODE ID']),
      };
    };

    // Build a mirror record straight from an incoming fields object (standalone, no Airtable).
    const buildStandaloneMirror = (fields, orgFields, existingId = null) => {
      const cleanFields = sanitizeForStorage(fields || {});
      const searchText = Object.values(cleanFields).map(valueText).join(' ').toLowerCase();
      return {
        airtable_record_id: existingId || `emp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fields: cleanFields,
        company: valueText(cleanFields[orgFields.company]).trim(),
        branch: valueText(cleanFields[orgFields.branch]).trim(),
        department: valueText(cleanFields[orgFields.department]).trim(),
        department_role: valueText(cleanFields[orgFields.role]).trim(),
        team: valueText(cleanFields[orgFields.team]).trim(),
        full_name: valueText(cleanFields[orgFields.fullName]).trim(),
        employee_code: valueText(cleanFields[orgFields.employeeCode]).trim(),
        search_text: searchText,
        synced_at: new Date().toISOString(),
      };
    };

    const listMirrorRecords = async (limit = 1000) => {
      return await base44.asServiceRole.entities[MIRROR_ENTITY].list('-updated_date', limit);
    };

    // Throttled write helper: retries on rate-limit/transient errors with backoff,
    // and spaces calls so a full Airtable pull stays under the Base44 write limit.
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const writeWithRetry = async (op, attempts = 3) => {
      let lastErr;
      for (let i = 0; i < attempts; i += 1) {
        try { return await op(); } catch (err) {
          lastErr = err;
          const m = String(err?.message || '').toLowerCase();
          const retryable = m.includes('429') || m.includes('rate limit') || m.includes('connection')
            || m.includes('timeout') || m.includes('network') || m.includes('fetch') || m.includes('socket')
            || m.includes('502') || m.includes('503') || m.includes('504');
          if (!retryable) throw err;
          await wait(Math.min(3000, 800 * (i + 1)) + Math.floor(Math.random() * 200));
        }
      }
      throw lastErr;
    };

    const accountFromRecord = (record) => {
      const fields = record.fields || {};
      return {
        airtable_record_id: record.airtable_record_id,
        full_name: record.full_name || fields['Full Name'] || '',
        email: fields['Business email'] || fields['Email'] || '',
        employee_code: fields['Employee Code'] || fields['Employee Code ID'] || record.employee_code || '',
        generated_password: generatedPassword(fields),
        job_title: clean(fields['Job Title']),
        status: isActive(record) ? 'active' : 'inactive',
        synced_at: new Date().toISOString(),
      };
    };

    // Keep the dedicated EmployeeAccount table in sync with the Airtable mirror so
    // User Management reads stored rows instead of recomputing on every open.
    const syncEmployeeAccounts = async () => {
      const mirror = await listMirrorRecords(5000);
      const existing = await base44.asServiceRole.entities.EmployeeAccount.list('-updated_date', 5000);
      const existingByAirtableId = new Map(existing.map((a) => [a.airtable_record_id, a]));
      const seen = new Set();
      const toCreate = [];

      for (const record of mirror) {
        seen.add(record.airtable_record_id);
        const account = accountFromRecord(record);
        const current = existingByAirtableId.get(record.airtable_record_id);
        if (!current) {
          toCreate.push(account);
        } else {
          const changed = ['full_name', 'email', 'employee_code', 'generated_password', 'job_title', 'status']
            .some((k) => String(current[k] || '') !== String(account[k] || ''));
          if (changed) { await writeWithRetry(() => base44.asServiceRole.entities.EmployeeAccount.update(current.id, account)); await wait(120); }
        }
      }

      for (let i = 0; i < toCreate.length; i += 50) {
        await writeWithRetry(() => base44.asServiceRole.entities.EmployeeAccount.bulkCreate(toCreate.slice(i, i + 50)));
        await wait(250);
      }
      for (const account of existing) {
        if (!seen.has(account.airtable_record_id)) { await writeWithRetry(() => base44.asServiceRole.entities.EmployeeAccount.delete(account.id)); await wait(120); }
      }
    };

    // Airtable write helpers. Only push fields that are real Airtable columns and not
    // computed/read-only (Airtable rejects writes to formula/auto fields with a 422).
    const AIRTABLE_READONLY = new Set([
      'RECORD ID', 'Calculated Employment Status', 'Tenure(Months)', 'New Formula Column',
      'Employee Code', 'Full Name', 'Employee #', 'Birth Month', 'Age', 'Years of Service',
      'Tenure', 'Year',
    ]);
    const airtableWritableFields = (fields) => {
      const out = {};
      for (const [key, value] of Object.entries(fields || {})) {
        if (AIRTABLE_READONLY.has(key)) continue;
        // Skip re-hosted file attachments (Base44 file_uri objects, not Airtable attachments).
        if (Array.isArray(value) && value.some((v) => v && typeof v === 'object' && v.file_uri)) continue;
        out[key] = value;
      }
      return out;
    };
    const airtableConfig = () => {
      const apiKey = Deno.env.get('AIRTABLE_API_KEY');
      const baseId = Deno.env.get('AIRTABLE_BASE_ID');
      const tableName = Deno.env.get('AIRTABLE_TABLE_NAME');
      if (!apiKey || !baseId || !tableName) throw new Error('Airtable is not configured.');
      return { apiKey, baseId, tableName };
    };
    // Create a new Airtable record; returns the new Airtable record id.
    const createInAirtable = async (fields) => {
      const { apiKey, baseId, tableName } = airtableConfig();
      const resp = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: airtableWritableFields(fields), typecast: true }),
      });
      if (!resp.ok) throw new Error(`Airtable create failed ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      return (await resp.json()).id;
    };
    // Patch an existing Airtable record by id, and verify the values actually landed.
    // Single-select fields silently drop a value when the option doesn't exist and
    // can't be auto-created (typecast) — that's what made saved edits "revert" after
    // the next Airtable sync. We re-read the record and compare so we can surface a
    // clear error instead of a false success.
    const updateInAirtable = async (airtableId, fields) => {
      const { apiKey, baseId, tableName } = airtableConfig();
      const writable = airtableWritableFields(fields);
      const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${airtableId}`;
      const resp = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: writable, typecast: true }),
      });
      if (!resp.ok) throw new Error(`Airtable update failed ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      const saved = (await resp.json())?.fields || {};
      // Detect text/select fields that Airtable silently dropped (sent a non-empty
      // value, but the record came back without it).
      const dropped = Object.entries(writable)
        .filter(([key, val]) => {
          if (val == null || val === '' || Array.isArray(val) || typeof val === 'object') return false;
          const after = saved[key];
          return String(after ?? '').trim() !== String(val).trim();
        })
        .map(([key]) => key);
      if (dropped.length) {
        throw new Error(`Airtable rejected new value(s) for: ${dropped.join(', ')}. This field is a single-select in Airtable and the option doesn't exist yet — add the option in Airtable first, then save again.`);
      }
    };
    // Delete an Airtable record by id.
    const deleteInAirtable = async (airtableId) => {
      const { apiKey, baseId, tableName } = airtableConfig();
      const resp = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${airtableId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) throw new Error(`Airtable delete failed ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    };

    // Fetch every record from the configured Airtable table (handles pagination).
    const fetchAirtableRecords = async () => {
      const apiKey = Deno.env.get('AIRTABLE_API_KEY');
      const baseId = Deno.env.get('AIRTABLE_BASE_ID');
      const tableName = Deno.env.get('AIRTABLE_TABLE_NAME');
      if (!apiKey || !baseId || !tableName) {
        throw new Error('Airtable is not configured. Set AIRTABLE_API_KEY, AIRTABLE_BASE_ID and AIRTABLE_TABLE_NAME.');
      }
      const records = [];
      let offset = null;
      do {
        const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
        url.searchParams.set('pageSize', '100');
        if (offset) url.searchParams.set('offset', offset);
        const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` } });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Airtable API error ${resp.status}: ${text.slice(0, 200)}`);
        }
        const data = await resp.json();
        records.push(...(data.records || []));
        offset = data.offset || null;
      } while (offset);
      return records;
    };

    // Pull the latest changes from Airtable into the Base44 mirror, then refresh
    // employee accounts. Existing re-hosted file attachments are preserved (Airtable
    // returns its own attachment URLs which we don't want to overwrite the hosted files with).
    // Airtable is no longer the source of truth — the backend employee mirror is.
    // This used to pull Airtable → mirror; now it's a no-op that only refreshes
    // EmployeeAccount rows from the mirror, so the existing automation stays valid
    // without ever overwriting in-app edits.
    const syncFromAirtable = async (dryRun = false) => {
      const existing = await listMirrorRecords(5000);
      if (dryRun) return { synced: existing.length, created: 0, updated: 0, removed: 0, dryRun: true, source: 'backend' };
      await syncEmployeeAccounts();
      return { synced: existing.length, created: 0, updated: 0, pending_updates: 0, removed: 0, source: 'backend' };
    };

    const buildHierarchy = async () => {
      const records = await listMirrorRecords(5000);
      const companies = new Map();
      const branches = new Map();
      const departments = new Map();
      const departmentRoles = new Map();

      for (const record of records) {
        if (!isNotResigned(record)) continue;
        const companyName = String(record.company || '').trim();
        const branchName = String(record.branch || '').trim();
        const departmentName = String(record.department || '').trim();
        const roleName = String(record.department_role || '').trim();

        if (companyName) {
          const companyId = slug(companyName);
          companies.set(companyId, { id: companyId, name: companyName, employee_count: (companies.get(companyId)?.employee_count || 0) + 1 });
        }
        if (branchName) {
          const branchId = slug(`${companyName || 'unassigned'}-${branchName}`);
          branches.set(branchId, {
            id: branchId,
            name: branchName,
            company_id: companyName ? slug(companyName) : '',
            company_name: companyName,
            employee_count: (branches.get(branchId)?.employee_count || 0) + 1,
          });
        }
        if (departmentName) {
          const departmentId = slug(`${companyName || 'unassigned'}-${branchName || 'unassigned'}-${departmentName}`);
          departments.set(departmentId, {
            id: departmentId,
            name: departmentName,
            code: departmentName.split(/\s+/).map(word => word[0]).join('').slice(0, 5).toUpperCase(),
            company_id: companyName ? slug(companyName) : '',
            company_name: companyName,
            branch_id: branchName ? slug(`${companyName || 'unassigned'}-${branchName}`) : '',
            branch_name: branchName,
            employee_count: (departments.get(departmentId)?.employee_count || 0) + 1,
          });
        }
        if (roleName) {
          const roleId = slug(`${companyName || 'unassigned'}-${branchName || 'unassigned'}-${departmentName || 'unassigned'}-${roleName}`);
          departmentRoles.set(roleId, {
            id: roleId,
            name: roleName,
            company_id: companyName ? slug(companyName) : '',
            company_name: companyName,
            branch_id: branchName ? slug(`${companyName || 'unassigned'}-${branchName}`) : '',
            branch_name: branchName,
            department_id: departmentName ? slug(`${companyName || 'unassigned'}-${branchName || 'unassigned'}-${departmentName}`) : '',
            department_name: departmentName,
            employee_count: (departmentRoles.get(roleId)?.employee_count || 0) + 1,
          });
        }
      }

      return {
        companies: Array.from(companies.values()).sort((a, b) => a.name.localeCompare(b.name)),
        branches: Array.from(branches.values()).sort((a, b) => a.name.localeCompare(b.name)),
        departments: Array.from(departments.values()).sort((a, b) => a.name.localeCompare(b.name)),
        departmentRoles: Array.from(departmentRoles.values()).sort((a, b) => a.name.localeCompare(b.name)),
      };
    };

    if (action === 'activeCount') {
      const allRecords = await listMirrorRecords(5000);
      return Response.json({ count: allRecords.filter(isActive).length });
    }

    const syncBiometricsMatch = async ({ employeeRecordId, employeeNumber, employeeName, airtableRecordId, matchStatus = 'manual' }) => {
      if (!employeeRecordId || !employeeNumber || !airtableRecordId) throw new Error('employeeRecordId, employeeNumber, and airtableRecordId are required');

      const orgFields = await getOrgFields();
      const existingMirror = await base44.asServiceRole.entities[MIRROR_ENTITY].filter({ airtable_record_id: airtableRecordId }, '-updated_date', 1);
      if (!existingMirror.length) throw new Error('Employee record not found.');

      const mergedFields = { ...(existingMirror[0].fields || {}), 'Biometrics Number': String(employeeNumber) };
      const mirrorData = buildStandaloneMirror(mergedFields, orgFields, airtableRecordId);
      const mirrored = await base44.asServiceRole.entities[MIRROR_ENTITY].update(existingMirror[0].id, mirrorData);

      const fields = mirrored.fields || {};
      const data = { id: mirrored.airtable_record_id, fields: mirrored.fields };
      const matchData = {
        employee_record_id: employeeRecordId,
        employee_number: String(employeeNumber),
        employee_name: employeeName,
        airtable_record_id: data.id,
        airtable_employee_code: valueText(fields[orgFields.employeeCode]).trim(),
        airtable_full_name: valueText(fields[orgFields.fullName]).trim() || [fields['First Name'], fields['Last Name']].filter(Boolean).join(' '),
        match_status: matchStatus,
        biometrics_synced: true,
        synced_at: new Date().toISOString(),
      };
      const existing = await base44.asServiceRole.entities.EmployeeAirtableMatch.filter({ employee_record_id: employeeRecordId }, '-updated_date', 1);
      const match = existing.length
        ? await base44.asServiceRole.entities.EmployeeAirtableMatch.update(existing[0].id, matchData)
        : await base44.asServiceRole.entities.EmployeeAirtableMatch.create(matchData);
      return { match, record: { id: data.id, fields: data.fields, backend_id: mirrored.id } };
    };

    if (action === 'syncBiometricsMatch') {
      const { employeeRecordId, employeeNumber, employeeName, airtableRecordId, matchStatus = 'manual' } = body;
      if (!employeeRecordId || !employeeNumber || !airtableRecordId) return Response.json({ error: 'employeeRecordId, employeeNumber, and airtableRecordId are required' }, { status: 400 });
      return Response.json(await syncBiometricsMatch({ employeeRecordId, employeeNumber, employeeName, airtableRecordId, matchStatus }));
    }

    if (action === 'autoMatchBiometrics') {
      await syncFromAirtable();
      const employees = await base44.asServiceRole.entities.Employee.list('-updated_date', 5000);
      const matches = await base44.asServiceRole.entities.EmployeeAirtableMatch.list('-updated_date', 5000);
      const matchedEmployeeIds = new Set(matches.map(match => match.employee_record_id));
      const airtableRecords = (await listMirrorRecords(5000)).filter(isNotResigned);
      let matched = 0;
      let skipped = 0;

      for (const employee of employees) {
        const employeeNumber = employee.biometric_id || employee.employee_id;
        if (!employeeNumber || matchedEmployeeIds.has(employee.id)) {
          skipped += 1;
          continue;
        }
        const matchRecord = airtableRecords.find(record => namesMatch(employee, record));
        if (!matchRecord) {
          skipped += 1;
          continue;
        }
        await syncBiometricsMatch({
          employeeRecordId: employee.id,
          employeeNumber,
          employeeName: localEmployeeName(employee),
          airtableRecordId: matchRecord.airtable_record_id,
          matchStatus: 'matched',
        });
        matched += 1;
      }

      return Response.json({ matched, skipped });
    }

    if (action === 'syncStatus') {
      const logs = await base44.asServiceRole.entities.SyncLog.list('-created_date', 1);
      return Response.json({ lastSync: logs[0] || null });
    }

    if (action === 'employeeAccounts') {
      // Read stored accounts (no recompute). Pass refresh:true to re-sync from Airtable first.
      if (body.refresh) await syncFromAirtable();
      const accounts = await base44.asServiceRole.entities.EmployeeAccount.list('full_name', 5000);
      return Response.json({ accounts });
    }

    if (action === 'employeeAccessStatus') {
      const currentUser = await base44.auth.me();
      if (currentUser.role === 'admin') return Response.json({ allowed: true, admin: true });
      if (!currentUser.employee_access_verified || !currentUser.employee_code) return Response.json({ allowed: false });
      const allRecords = await listMirrorRecords(5000);
      const matched = allRecords.find(record => clean(record.fields?.['Employee Code'] || record.fields?.['Employee Code ID'] || record.employee_code).toLowerCase() === clean(currentUser.employee_code).toLowerCase());
      if (!matched || !isActive(matched)) {
        await base44.auth.updateMe({ employee_access_verified: false, employee_account_status: 'disabled' });
        return Response.json({ allowed: false, message: 'Your employee account is no longer active. Please contact HR.' });
      }
      // If the employee's role (Job Title) changed in Airtable, reset verification so they
      // re-verify and adopt the new role's access on their next refresh.
      const currentRole = clean(matched.fields?.['Job Title']);
      if (currentRole && clean(currentUser.internal_role).toLowerCase() !== currentRole.toLowerCase()) {
        await base44.auth.updateMe({ employee_access_verified: false });
        return Response.json({ allowed: false, message: 'Your role has been updated. Please sign in again to refresh your access.' });
      }
      return Response.json({ allowed: true });
    }

    if (action === 'validateEmployeeAccess') {
      const { employeeCode, password } = body;
      const currentUser = await base44.auth.me();
      const allRecords = await listMirrorRecords(5000);
      const matched = allRecords.find(record => clean(record.fields?.['Employee Code'] || record.fields?.['Employee Code ID'] || record.employee_code).toLowerCase() === clean(employeeCode).toLowerCase());
      if (!matched || !isActive(matched)) return Response.json({ allowed: false, message: 'Employee account is inactive or not found.' });
      const fields = matched.fields || {};
      const recordEmail = clean(fields['Business email'] || fields['Email']).toLowerCase();
      if (recordEmail && recordEmail !== clean(currentUser.email).toLowerCase()) return Response.json({ allowed: false, message: 'This employee code does not match your logged-in email.' });
      if (clean(password).toUpperCase() !== generatedPassword(fields).toUpperCase()) return Response.json({ allowed: false, message: 'Invalid employee code or password.' });
      await base44.auth.updateMe({
        employee_code: clean(employeeCode),
        employee_airtable_record_id: matched.airtable_record_id,
        employee_access_verified: true,
        employee_account_status: 'active',
        internal_role: clean(fields['Job Title']),
        employee_password_last_verified_at: new Date().toISOString(),
      });
      return Response.json({ allowed: true });
    }

    if (action === 'schema') {
      // Derive a lightweight schema from existing mirror records (standalone, no Airtable).
      const sample = await listMirrorRecords(500);
      const fieldsMeta = {};
      // Column type markers persisted on a settings record so empty file columns
      // are remembered even before any record stores a value for them.
      const markerRows = await base44.asServiceRole.entities.AppSettings.filter({ key: 'airtable_column_types' }, '-updated_date', 1).catch(() => []);
      const typeMarkers = markerRows?.[0]?.value || {};

      for (const record of sample) {
        for (const [key, value] of Object.entries(record.fields || {})) {
          if (fieldsMeta[key]) continue;
          // Re-hosted file column: array of { file_uri } objects.
          if (Array.isArray(value) && value.some((v) => v && typeof v === 'object' && v.file_uri)) {
            fieldsMeta[key] = { type: 'fileAttachment' };
          } else {
            fieldsMeta[key] = { type: typeof value === 'number' ? 'number' : 'singleLineText' };
          }
        }
      }
      // Apply persisted markers (covers columns with no stored value yet).
      for (const [key, type] of Object.entries(typeMarkers)) {
        if (!fieldsMeta[key]) fieldsMeta[key] = { type };
      }
      return Response.json({ computedFields: [], fieldsMeta });
    }

    // Diagnostic: list the tables Airtable actually sees for the configured base,
    // so a 404 (wrong base id / table name) can be pinpointed quickly.
    if (action === 'airtableDiagnostics') {
      const apiKey = Deno.env.get('AIRTABLE_API_KEY');
      const baseId = Deno.env.get('AIRTABLE_BASE_ID');
      const tableName = Deno.env.get('AIRTABLE_TABLE_NAME');
      const meta = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers: { Authorization: `Bearer ${apiKey}` } });
      const metaText = await meta.text();
      let tables = null;
      try {
        tables = (JSON.parse(metaText).tables || []).map(t => ({ name: t.name, id: t.id }));
      } catch (_e) { /* keep raw */ }
      return Response.json({
        configured: { baseId_prefix: String(baseId || '').slice(0, 4), baseId_length: String(baseId || '').length, tableName },
        meta_status: meta.status,
        tables: tables || metaText.slice(0, 300),
      });
    }

    if (action === 'syncFromAirtable') {
      const startedAt = new Date();
      try {
        const result = await syncFromAirtable(body.dryRun === true);
        if (body.dryRun === true) return Response.json(result);
        const finishedAt = new Date();
        await base44.asServiceRole.entities.SyncLog.create({
          kind: 'airtable', status: 'success',
          started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
          duration_ms: finishedAt - startedAt, total_synced: result.synced || 0, error_count: 0,
          summary: result, message: 'Airtable → Base44',
        }).catch(() => {});
        return Response.json(result);
      } catch (error) {
        const finishedAt = new Date();
        await base44.asServiceRole.entities.SyncLog.create({
          kind: 'airtable', status: 'error',
          started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
          duration_ms: finishedAt - startedAt, message: error.message,
        }).catch(() => {});
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    if (action === 'matchCandidates') {
      const allRecords = await listMirrorRecords(5000);
      const records = allRecords.filter(isNotResigned).map(record => ({
        id: record.airtable_record_id,
        airtable_record_id: record.airtable_record_id,
        backend_id: record.id,
        fields: record.fields || {},
        full_name: record.full_name,
        employee_code: record.employee_code,
      }));
      return Response.json({ records });
    }

    if (action === 'list') {
      const { pageSize = 50, offset = 0, search } = body;
      // The Airtable Employee List is the full record-management table, so it shows
      // every employee including resigned ones (other actions stay active-only).
      const allRecords = await listMirrorRecords(5000);
      const filtered = search?.trim()
        ? allRecords.filter(record => String(record.search_text || '').includes(search.trim().toLowerCase()))
        : allRecords;
      const start = Number(offset) || 0;
      const records = filtered.slice(start, start + Math.min(pageSize, 100)).map(record => {
        const fields = { ...(record.fields || {}) };
        if (!fields.Company && !fields.COMPANY && record.company) fields.Company = record.company;
        return {
          id: record.airtable_record_id,
          fields,
          backend_id: record.id,
        };
      });
      const nextOffset = start + records.length < filtered.length ? String(start + records.length) : null;
      return Response.json({ records, offset: nextOffset, source: 'backend' });
    }

    if (action === 'allActive') {
      const allRecords = await listMirrorRecords(5000);
      const records = allRecords.filter(isNotResigned).map(record => {
        const fields = { ...(record.fields || {}) };
        if (!fields.Company && !fields.COMPANY && record.company) fields.Company = record.company;
        if (!fields.Branch && !fields.BRANCH && record.branch) fields.Branch = record.branch;
        if (!fields.Department && record.department) fields.Department = record.department;
        if (!fields['Department Role'] && record.department_role) fields['Department Role'] = record.department_role;
        return { id: record.airtable_record_id, fields, backend_id: record.id };
      });
      return Response.json({ records });
    }

    if (action === 'employeeNames') {
      // Every full name across the entire active employee list, for "from employee list" dropdowns.
      const allRecords = await listMirrorRecords(5000);
      const names = new Set();
      for (const record of allRecords.filter(isNotResigned)) {
        const name = clean(record.full_name || record.fields?.['Full Name'] || record.fields?.['Employee Code ID']);
        if (name) names.add(name);
      }
      return Response.json({ names: Array.from(names).sort((a, b) => a.localeCompare(b)) });
    }

    if (action === 'organizationHierarchy') {
      return Response.json(await buildHierarchy());
    }

    if (action === 'companies') {
      const hierarchy = await buildHierarchy();
      return Response.json({ companies: hierarchy.companies });
    }

    if (action === 'branches') {
      const hierarchy = await buildHierarchy();
      return Response.json({ branches: hierarchy.branches });
    }

    if (action === 'departments') {
      const hierarchy = await buildHierarchy();
      return Response.json({ departments: hierarchy.departments });
    }

    if (action === 'departmentRoles') {
      const hierarchy = await buildHierarchy();
      return Response.json({ departmentRoles: hierarchy.departmentRoles });
    }

    if (action === 'fieldChoices') {
      // Distinct dropdown values for org/HR columns, gathered from every active mirror record
      // so the edit form's Department Role / Branch / Department / Team / Job Title dropdowns
      // list every value currently in use (not just whatever is on the page being edited).
      const orgFields = await getOrgFields();
      const allRecords = await listMirrorRecords(5000);
      const records = allRecords.filter(isNotResigned);
      const columns = {
        [orgFields.branch]: new Set(),
        [orgFields.department]: new Set(),
        [orgFields.role]: new Set(),
        [orgFields.team]: new Set(),
        'Job Title': new Set(),
      };
      for (const record of records) {
        const fields = record.fields || {};
        for (const col of Object.keys(columns)) {
          const raw = fields[col];
          const text = valueText(raw).trim();
          if (text) columns[col].add(text);
        }
      }
      // Job titles come from EVERY record (including resigned employees) so a valid title
      // is still selectable even when its only current holders have resigned.
      for (const record of allRecords) {
        const text = valueText((record.fields || {})['Job Title']).trim();
        if (text) columns['Job Title'].add(text);
      }
      const choices = {};
      for (const [col, set] of Object.entries(columns)) {
        choices[col] = Array.from(set).sort((a, b) => a.localeCompare(b)).map((name) => ({ name }));
      }
      return Response.json({ choices });
    }

    // Upsert the single EmployeeAccount row for one mirror record, so User Management
    // reflects edits made directly in the app (without waiting for a full Airtable pull).
    const upsertAccountForRecord = async (mirrorRecord) => {
      const account = accountFromRecord({ airtable_record_id: mirrorRecord.airtable_record_id, full_name: mirrorRecord.full_name, employee_code: mirrorRecord.employee_code, fields: mirrorRecord.fields });
      const existing = await base44.asServiceRole.entities.EmployeeAccount.filter({ airtable_record_id: mirrorRecord.airtable_record_id }, '-updated_date', 1);
      if (existing.length) await base44.asServiceRole.entities.EmployeeAccount.update(existing[0].id, account);
      else await base44.asServiceRole.entities.EmployeeAccount.create(account);
    };

    if (action === 'publicOnboard') {
      // Public new-hire self-service form. Accepts only a fixed whitelist of basic
      // Identity / Contact / Government ID fields — never org, salary, or status fields.
      const incoming = body.fields || {};
      const ALLOWED = new Set([
        'First Name', 'Middle Name', 'Last Name', 'Gender', 'Birthday', 'Citizen Status',
        'Email', 'Business email', 'Mobile Number', 'Address',
        'Emergency Contact Name', 'Emergency Contact Number', 'Emergency Contact Relationship',
        'SSS Number', 'PhilHealth Number', 'Pag-IBIG Number', 'TIN',
      ]);
      const fields = {};
      for (const [key, value] of Object.entries(incoming)) {
        if (ALLOWED.has(key) && clean(value)) fields[key] = clean(value);
      }
      if (!fields['First Name'] || !fields['Last Name']) {
        return Response.json({ error: 'First Name and Last Name are required.' }, { status: 400 });
      }
      const orgFields = await getOrgFields();
      const mirrorData = buildStandaloneMirror(fields, orgFields);
      const created = await base44.asServiceRole.entities[MIRROR_ENTITY].create(mirrorData);
      await upsertAccountForRecord(created).catch(() => {});
      return Response.json({ ok: true });
    }

    if (action === 'create') {
      const { fields } = body;
      const orgFields = await getOrgFields();
      // Backend mirror is the source of truth — create directly with a backend id (no Airtable push).
      const mirrorData = buildStandaloneMirror(fields, orgFields);
      const created = await base44.asServiceRole.entities[MIRROR_ENTITY].create(mirrorData);
      await upsertAccountForRecord(created).catch(() => {});
      return Response.json({ record: { id: created.airtable_record_id, fields: created.fields, backend_id: created.id } });
    }

    if (action === 'update') {
      const { recordId, fields } = body;
      if (!recordId) return Response.json({ error: 'recordId required' }, { status: 400 });
      const orgFields = await getOrgFields();
      const existing = await writeWithRetry(() => base44.asServiceRole.entities[MIRROR_ENTITY].filter({ airtable_record_id: recordId }, '-updated_date', 1));
      if (!existing.length) return Response.json({ error: 'Record not found' }, { status: 404 });
      const mergedFields = { ...(existing[0].fields || {}), ...fields };
      // Backend mirror is the source of truth — update it directly (no Airtable push).
      const mirrorData = buildStandaloneMirror(mergedFields, orgFields, recordId);
      const updated = await writeWithRetry(() => base44.asServiceRole.entities[MIRROR_ENTITY].update(existing[0].id, mirrorData));
      await upsertAccountForRecord(updated).catch(() => {});
      return Response.json({ record: { id: updated.airtable_record_id, fields: updated.fields, backend_id: updated.id } });
    }

    if (action === 'reassignEmployeeCategory') {
      const { recordId, category, target } = body;
      if (!recordId || !category || !target?.name) return Response.json({ error: 'recordId, category, and target are required' }, { status: 400 });

      const orgFields = await getOrgFields();
      const fieldMap = {
        company: orgFields.company,
        branch: orgFields.branch,
        department: orgFields.department,
        department_role: orgFields.role,
        team: orgFields.team,
      };
      const targetField = fieldMap[category];
      if (!targetField) return Response.json({ error: `Column for ${category.replace('_', ' ')} was not found.` }, { status: 404 });

      const updates = { [targetField]: String(target.name || '').trim() };
      if (orgFields.company && target.company_name) updates[orgFields.company] = String(target.company_name).trim();
      if (orgFields.branch && target.branch_name) updates[orgFields.branch] = String(target.branch_name).trim();
      if (orgFields.department && target.department_name) updates[orgFields.department] = String(target.department_name).trim();

      const existing = await base44.asServiceRole.entities[MIRROR_ENTITY].filter({ airtable_record_id: recordId }, '-updated_date', 1);
      if (!existing.length) return Response.json({ error: 'Record not found' }, { status: 404 });
      const mergedFields = { ...(existing[0].fields || {}), ...updates };
      const mirrorData = buildStandaloneMirror(mergedFields, orgFields, recordId);
      const mirrored = await base44.asServiceRole.entities[MIRROR_ENTITY].update(existing[0].id, mirrorData);
      return Response.json({ record: { id: mirrored.airtable_record_id, fields: mirrored.fields, backend_id: mirrored.id } });
    }

    if (action === 'updateCompanyForBranch') {
      const { branchName, companyName } = body;
      const cleanBranch = String(branchName || '').trim();
      const cleanCompany = String(companyName || '').trim();
      if (!cleanBranch || !cleanCompany) return Response.json({ error: 'branchName and companyName are required' }, { status: 400 });

      const orgFields = await getOrgFields();
      const allRecords = await listMirrorRecords(5000);
      const matching = allRecords.filter(record =>
        String(record.fields?.[orgFields.branch] || record.branch || '').trim() === cleanBranch &&
        String(record.fields?.[orgFields.company] || record.company || '').trim() !== cleanCompany
      );

      for (const record of matching) {
        const mergedFields = { ...(record.fields || {}), [orgFields.company]: cleanCompany };
        const mirrorData = buildStandaloneMirror(mergedFields, orgFields, record.airtable_record_id);
        await base44.asServiceRole.entities[MIRROR_ENTITY].update(record.id, mirrorData);
      }

      return Response.json({ updated: matching.length });
    }

    if (action === 'renameField') {
      const { fieldName, newName } = body;
      const oldKey = String(fieldName || '').trim();
      const cleanNew = String(newName || '').trim();
      if (!oldKey || !cleanNew) return Response.json({ error: 'fieldName and newName required' }, { status: 400 });
      const orgFields = await getOrgFields();
      const allRecords = await listMirrorRecords(5000);
      let renamed = 0;
      for (const record of allRecords) {
        const fields = record.fields || {};
        if (!(oldKey in fields)) continue;
        const newFields = {};
        for (const [key, value] of Object.entries(fields)) {
          newFields[key === oldKey ? cleanNew : key] = value;
        }
        const mirrorData = buildStandaloneMirror(newFields, orgFields, record.airtable_record_id);
        await base44.asServiceRole.entities[MIRROR_ENTITY].update(record.id, mirrorData);
        renamed += 1;
      }
      return Response.json({ field: { name: cleanNew }, renamed });
    }

    if (action === 'createField') {
      const { name, type } = body;
      const cleanName = String(name || '').trim();
      if (!cleanName) return Response.json({ error: 'Column name is required' }, { status: 400 });
      const sample = await listMirrorRecords(500);
      const exists = sample.some(record => Object.keys(record.fields || {}).some(key => key.toLowerCase() === cleanName.toLowerCase()));
      if (exists) return Response.json({ error: `A column named "${cleanName}" already exists.` }, { status: 409 });

      // Persist a type marker so the column's type (esp. file attachments) is
      // remembered even before any record stores a value for it.
      if (type) {
        const rows = await base44.asServiceRole.entities.AppSettings.filter({ key: 'airtable_column_types' }, '-updated_date', 1).catch(() => []);
        const markers = { ...(rows?.[0]?.value || {}), [cleanName]: type };
        if (rows?.[0]) await base44.asServiceRole.entities.AppSettings.update(rows[0].id, { value: markers });
        else await base44.asServiceRole.entities.AppSettings.create({ key: 'airtable_column_types', value: markers });
      }
      // Columns are derived from record keys; the new column becomes visible once a
      // record stores a value for it. Return success so the UI can add it to the grid.
      return Response.json({ field: { name: cleanName } });
    }

    if (action === 'delete') {
      const { recordId } = body;
      if (!recordId) return Response.json({ error: 'recordId required' }, { status: 400 });
      // Backend mirror is the source of truth — delete it directly (no Airtable call).
      const existing = await base44.asServiceRole.entities[MIRROR_ENTITY].filter({ airtable_record_id: recordId }, '-updated_date', 10);
      for (const record of existing) await base44.asServiceRole.entities[MIRROR_ENTITY].delete(record.id);
      return Response.json({ deleted: true, id: recordId });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
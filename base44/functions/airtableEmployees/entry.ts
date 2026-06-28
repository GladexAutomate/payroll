import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MIRROR_ENTITY = 'AirtableEmployeeRecord';

// --- Direct Supabase mirroring -------------------------------------------------
// Every write made through this function (employee records AND the derived
// EmployeeAccount rows that power User Management) is pushed straight into the
// matching Supabase production table here, synchronously. This guarantees changes
// reach Supabase immediately without depending on a Base44 entity automation being
// configured, and without waiting for the 5-minute syncToSupabase sweep (which still
// runs as a reconciling fallback). All pushes are best-effort: a Supabase hiccup is
// logged but never blocks the employee edit — the sweep will reconcile later.
const supabaseRestBase = (rawUrl) => {
  let base = String(rawUrl || '').replace(/\/+$/, '');
  if (!/\/rest\/v1$/.test(base)) base = `${base}/rest/v1`;
  return base;
};
const supabaseTable = (entityName) => String(entityName || '').toLowerCase();

const supabaseEnsureTable = async (baseUrl, key, table) => {
  const sql = `create table if not exists public.${table} (id text primary key, data jsonb);`;
  const res = await fetch(`${supabaseRestBase(baseUrl)}/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`ensureTable ${table} failed (${res.status}): ${await res.text()}`);
};

const supabaseUpsertRow = async (baseUrl, key, table, row) => {
  const res = await fetch(`${supabaseRestBase(baseUrl)}/${table}?on_conflict=id`, {
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
};

const supabaseDeleteRow = async (baseUrl, key, table, id) => {
  const res = await fetch(`${supabaseRestBase(baseUrl)}/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Supabase delete ${table} failed (${res.status}): ${await res.text()}`);
};

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

// Known company → short code mappings for auto-generated employee codes.
// Keys are normalized (lowercased, alphanumeric only) so spacing/punctuation don't matter.
const COMPANY_CODE_MAP = {
  'gladextravelandtourscorp': 'GDX',
  'gladextravelandtours': 'GDX',
  'klikktravelexpress': 'KLIKK',
  'pinoyonlinetravelbiz': 'POTB',
};
const normalizeCompanyKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Derive a company code: use the known map, else build initials from the company name.
const companyCodeFor = (companyName) => {
  const key = normalizeCompanyKey(companyName);
  if (COMPANY_CODE_MAP[key]) return COMPANY_CODE_MAP[key];
  const initials = String(companyName || '').trim().split(/\s+/)
    .map((word) => word[0]).filter(Boolean).join('').toUpperCase();
  return initials || 'EMP';
};
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

    // Supabase production target for direct mirroring. If the secrets aren't set the
    // pushes become no-ops and the scheduled syncToSupabase sweep remains the only path.
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SECRET_KEY = Deno.env.get('SUPABASE_SECRET_KEY');
    const supabaseReady = !!(SUPABASE_URL && SUPABASE_SECRET_KEY);

    // Push one saved entity record into its Supabase table (table = lowercase entity
    // name), keyed by the Base44 record id so it matches rows written by the sweep.
    // Best-effort: never throws, so a Supabase outage can't break an employee edit.
    const pushToSupabase = async (entityName, record) => {
      if (!supabaseReady || !record?.id) return;
      const table = supabaseTable(entityName);
      try {
        try { await supabaseEnsureTable(SUPABASE_URL, SUPABASE_SECRET_KEY, table); } catch (_e) { /* table likely exists */ }
        await supabaseUpsertRow(SUPABASE_URL, SUPABASE_SECRET_KEY, table, { id: record.id, data: record });
      } catch (err) { console.error(`Supabase push ${table} failed:`, err?.message || err); }
    };
    const removeFromSupabase = async (entityName, id) => {
      if (!supabaseReady || !id) return;
      try { await supabaseDeleteRow(SUPABASE_URL, SUPABASE_SECRET_KEY, supabaseTable(entityName), id); }
      catch (err) { console.error(`Supabase delete ${supabaseTable(entityName)} failed:`, err?.message || err); }
    };

    const body = await req.json();
    const { action } = body;

    // Backend-only actions can run unattended (e.g. the consolidation orchestrator via
    // service role). All other actions require an authenticated user.
    // publicOnboard is reachable without login (new-hire self-service form link).
    const BACKEND_ACTIONS = new Set(['syncStatus', 'publicOnboard', 'onboardChoices']);
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

    // Generate the next available employee code for a company, formatted as
    // CODE + currentYear + '-' + 0000 (e.g. GDX2026-0001). Scans every mirror record
    // for the highest existing sequence under the same prefix so codes never collide.
    const generateEmployeeCode = async (companyName) => {
      const code = companyCodeFor(companyName);
      const year = new Date().getFullYear();
      // The sequence is unique per company ACROSS ALL YEARS, so match any code that
      // starts with this company code followed by a 4-digit year and '-', regardless
      // of which year it was issued in (e.g. GDX2025-0007 and GDX2026-0003 share one counter).
      const seqPattern = new RegExp(`^${code}\\d{4}-(\\d+)$`, 'i');
      const allRecords = await listMirrorRecords(5000);
      let maxSeq = 0;
      for (const record of allRecords) {
        const existing = clean(record.employee_code || record.fields?.['Employee Code ID'] || record.fields?.['Employee Code']);
        const match = existing.match(seqPattern);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
      return `${code}${year}-${String(maxSeq + 1).padStart(4, '0')}`;
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
          if (changed) {
            const updated = await writeWithRetry(() => base44.asServiceRole.entities.EmployeeAccount.update(current.id, account));
            await pushToSupabase('EmployeeAccount', updated);
            await wait(120);
          }
        }
      }

      for (let i = 0; i < toCreate.length; i += 50) {
        const created = await writeWithRetry(() => base44.asServiceRole.entities.EmployeeAccount.bulkCreate(toCreate.slice(i, i + 50)));
        for (const row of (Array.isArray(created) ? created : [])) await pushToSupabase('EmployeeAccount', row);
        await wait(250);
      }
      for (const account of existing) {
        if (!seen.has(account.airtable_record_id)) {
          await writeWithRetry(() => base44.asServiceRole.entities.EmployeeAccount.delete(account.id));
          await removeFromSupabase('EmployeeAccount', account.id);
          await wait(120);
        }
      }
    };

    // Refresh the EmployeeAccount rows from the Base44 employee mirror (the source of
    // truth). Airtable is no longer involved anywhere in this app.
    const refreshEmployeeAccounts = async () => {
      await syncEmployeeAccounts();
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
      await pushToSupabase(MIRROR_ENTITY, mirrored);

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
      await refreshEmployeeAccounts();
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
      // Read stored accounts (no recompute). Pass refresh:true to rebuild them from the mirror first.
      if (body.refresh) await refreshEmployeeAccounts();
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

    if (action === 'saveHiddenColumns') {
      // Persist the user's hidden-column preference for the Airtable Employee List on
      // their own user record, so it survives the browser cache being cleared and follows
      // them across devices/sessions.
      const columns = Array.isArray(body.columns) ? body.columns.map((c) => String(c)) : [];
      await base44.auth.updateMe({ airtable_hidden_columns: columns });
      return Response.json({ ok: true, columns });
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
      const { pageSize = 50, offset = 0, search, columnFilters, sort } = body;
      // The Airtable Employee List is the full record-management table, so it shows
      // every employee including resigned ones (other actions stay active-only).
      const allRecords = await listMirrorRecords(5000);

      // The text shown in a given column's cell, so per-column search matches what the
      // user actually sees. "Full Name" is displayed as First + Middle + Last (falling
      // back to the stored Full Name field), so we search that same composed value.
      const columnText = (record, column) => {
        const fields = record.fields || {};
        if (String(column).trim().toLowerCase() === 'full name') {
          const parts = [fields['First Name'], fields['Middle Name'], fields['Last Name']]
            .map((part) => valueText(part).trim()).filter(Boolean);
          return (parts.length ? parts.join(' ') : valueText(fields['Full Name'])).toLowerCase();
        }
        return valueText(fields[column]).toLowerCase();
      };

      // Global search across the whole roster (precomputed search_text).
      let filtered = search?.trim()
        ? allRecords.filter(record => String(record.search_text || '').includes(search.trim().toLowerCase()))
        : allRecords;

      // Per-column search: every active column filter must match (AND), applied across the
      // ENTIRE dataset before pagination — so results are accurate, not just within one page.
      const activeFilters = columnFilters && typeof columnFilters === 'object'
        ? Object.entries(columnFilters).filter(([, value]) => String(value ?? '').trim())
        : [];
      if (activeFilters.length) {
        filtered = filtered.filter(record => activeFilters.every(([column, value]) =>
          columnText(record, column).includes(String(value).trim().toLowerCase())));
      }

      // Sort across the whole filtered dataset so ordering is consistent across pages.
      if (sort && sort.column && (sort.direction === 'asc' || sort.direction === 'desc')) {
        filtered = [...filtered].sort((a, b) => {
          const comparison = columnText(a, sort.column)
            .localeCompare(columnText(b, sort.column), undefined, { numeric: true, sensitivity: 'base' });
          return sort.direction === 'asc' ? comparison : -comparison;
        });
      }

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
      return Response.json({ records, offset: nextOffset, total: filtered.length, source: 'backend' });
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
      // headNames is the First Name + Last Name only (compound surnames preserved), used for
      // the Immediate Head dropdown so a head can be picked instead of free-typed.
      const allRecords = await listMirrorRecords(5000);
      const names = new Set();
      const headNames = new Set();
      for (const record of allRecords.filter(isNotResigned)) {
        const fields = record.fields || {};
        const name = clean(record.full_name || fields['Full Name'] || fields['Employee Code ID']);
        if (name) names.add(name);
        const firstLast = [clean(fields['First Name']), clean(fields['Last Name'])].filter(Boolean).join(' ');
        if (firstLast) headNames.add(firstLast);
      }
      const sortNames = (set) => Array.from(set).sort((a, b) => a.localeCompare(b));
      return Response.json({ names: sortNames(names), headNames: sortNames(headNames) });
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
      const saved = existing.length
        ? await base44.asServiceRole.entities.EmployeeAccount.update(existing[0].id, account)
        : await base44.asServiceRole.entities.EmployeeAccount.create(account);
      await pushToSupabase('EmployeeAccount', saved);
    };

    if (action === 'onboardChoices') {
      // Public: distinct Position / Department / Branch values for the onboarding form dropdowns.
      const orgFields = await getOrgFields();
      const allRecords = await listMirrorRecords(5000);
      const records = allRecords.filter(isNotResigned);
      const companies = new Set();
      const positions = new Set();
      const departments = new Set();
      const branches = new Set();
      for (const record of records) {
        const fields = record.fields || {};
        const comp = valueText(fields[orgFields.company] || fields['Company'] || record.company).trim();
        const pos = valueText(fields['Job Title'] || fields['Position']).trim();
        const dep = valueText(fields[orgFields.department] || fields['Department']).trim();
        const br = valueText(fields[orgFields.branch] || fields['Branch']).trim();
        if (comp) companies.add(comp);
        if (pos) positions.add(pos);
        if (dep) departments.add(dep);
        if (br) branches.add(br);
      }
      const sortNames = (set) => Array.from(set).sort((a, b) => a.localeCompare(b)).map((name) => ({ name }));
      return Response.json({ Company: sortNames(companies), Position: sortNames(positions), Department: sortNames(departments), Branch: sortNames(branches) });
    }

    if (action === 'publicOnboard') {
      // Public new-hire self-service form. Accepts only a fixed whitelist of basic
      // Identity / Contact / Government ID fields — never org, salary, or status fields.
      const incoming = body.fields || {};
      const ALLOWED = new Set([
        'First Name', 'Middle Name', 'Last Name', 'Company', 'Position', 'Job Title', 'Gender', 'Birthday', 'Citizen Status',
        'Department', 'Branch', 'Date Hired', 'Educational background', 'Status',
        'Email', 'Business email', 'Mobile Number', 'Address',
        'Emergency Contact Name', 'Emergency Contact Number', 'Emergency Contact Relationship',
        'SSS Number', 'PhilHealth Number', 'Pag-IBIG Number', 'TIN',
      ]);
      const fields = {};
      for (const [key, value] of Object.entries(incoming)) {
        if (ALLOWED.has(key) && clean(value)) fields[key] = clean(value);
      }
      // "Position" maps to the Job Title column used everywhere else in the app.
      if (fields['Position'] && !fields['Job Title']) { fields['Job Title'] = fields['Position']; delete fields['Position']; }
      if (!fields['First Name'] || !fields['Last Name']) {
        return Response.json({ error: 'First Name and Last Name are required.' }, { status: 400 });
      }
      // Auto-generate a unique employee code from the chosen company + current year.
      if (fields['Company'] && !fields['Employee Code ID']) {
        fields['Employee Code ID'] = await generateEmployeeCode(fields['Company']);
      }
      const orgFields = await getOrgFields();
      const mirrorData = buildStandaloneMirror(fields, orgFields);
      const created = await base44.asServiceRole.entities[MIRROR_ENTITY].create(mirrorData);
      await pushToSupabase(MIRROR_ENTITY, created);
      await upsertAccountForRecord(created).catch(() => {});
      return Response.json({ ok: true });
    }

    if (action === 'create') {
      const { fields } = body;
      const orgFields = await getOrgFields();
      // Auto-generate a unique employee code from the chosen company + current year when one isn't supplied.
      const companyName = clean(fields?.[orgFields.company] || fields?.['Company']);
      if (companyName && !clean(fields?.['Employee Code ID']) && !clean(fields?.['Employee Code'])) {
        fields['Employee Code ID'] = await generateEmployeeCode(companyName);
      }
      // Backend mirror is the source of truth — create directly with a backend id (no Airtable push).
      const mirrorData = buildStandaloneMirror(fields, orgFields);
      const created = await base44.asServiceRole.entities[MIRROR_ENTITY].create(mirrorData);
      await pushToSupabase(MIRROR_ENTITY, created);
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
      await pushToSupabase(MIRROR_ENTITY, updated);
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
      await pushToSupabase(MIRROR_ENTITY, mirrored);
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
        const mirrored = await base44.asServiceRole.entities[MIRROR_ENTITY].update(record.id, mirrorData);
        await pushToSupabase(MIRROR_ENTITY, mirrored);
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
        const mirrored = await base44.asServiceRole.entities[MIRROR_ENTITY].update(record.id, mirrorData);
        await pushToSupabase(MIRROR_ENTITY, mirrored);
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
      // Backend mirror is the source of truth — delete it directly (no Airtable call),
      // and propagate the delete to Supabase so removed employees don't linger there.
      const existing = await base44.asServiceRole.entities[MIRROR_ENTITY].filter({ airtable_record_id: recordId }, '-updated_date', 10);
      for (const record of existing) {
        await base44.asServiceRole.entities[MIRROR_ENTITY].delete(record.id);
        await removeFromSupabase(MIRROR_ENTITY, record.id);
      }
      // Remove the linked User Management account(s) too, in Base44 and in Supabase.
      const linkedAccounts = await base44.asServiceRole.entities.EmployeeAccount.filter({ airtable_record_id: recordId }, '-updated_date', 10);
      for (const account of linkedAccounts) {
        await base44.asServiceRole.entities.EmployeeAccount.delete(account.id);
        await removeFromSupabase('EmployeeAccount', account.id);
      }
      return Response.json({ deleted: true, id: recordId });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
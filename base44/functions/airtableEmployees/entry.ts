import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BASE_ID = 'appNRjLCu4uxT395V';
const TABLE_ID = 'tblAOjFrCv9R6fFKq';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
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

    const getTableSchema = async () => {
      const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Schema fetch failed');
      const table = (data.tables || []).find(t => t.id === TABLE_ID);
      if (!table) throw new Error('Table not found in schema');
      return table;
    };

    const pickField = (fields, candidates) => {
      const names = fields.map(field => field.name);
      return names.find(name => candidates.map(normalizeField).includes(normalizeField(name))) || null;
    };

    const getOrgFields = async () => {
      const table = await getTableSchema();
      const fields = table.fields || [];
      return {
        company: pickField(fields, ['Company', 'COMPANY']),
        branch: pickField(fields, ['Branch', 'BRANCH']),
        department: pickField(fields, ['Department', 'DEPARTMENT']),
        role: pickField(fields, ['Department Role', 'DEPARTMENT ROLE']),
        team: pickField(fields, ['Team', 'TEAM']),
        fullName: pickField(fields, ['Full Name', 'FULL NAME']),
        employeeCode: pickField(fields, ['Employee Code ID', 'Employee Code', 'EMPLOYEE CODE ID']),
      };
    };

    const toMirrorRecord = (record, orgFields) => {
      const fields = sanitizeForStorage(record.fields || {});
      const searchText = Object.values(fields).map(valueText).join(' ').toLowerCase();
      return {
        airtable_record_id: record.id,
        fields,
        company: valueText(fields[orgFields.company]).trim(),
        branch: valueText(fields[orgFields.branch]).trim(),
        department: valueText(fields[orgFields.department]).trim(),
        department_role: valueText(fields[orgFields.role]).trim(),
        team: valueText(fields[orgFields.team]).trim(),
        full_name: valueText(fields[orgFields.fullName]).trim(),
        employee_code: valueText(fields[orgFields.employeeCode]).trim(),
        search_text: searchText,
        synced_at: new Date().toISOString(),
      };
    };

    const upsertMirrorRecord = async (record, orgFields) => {
      const data = toMirrorRecord(record, orgFields);
      const existing = await base44.asServiceRole.entities[MIRROR_ENTITY].filter({ airtable_record_id: record.id }, '-updated_date', 1);
      if (existing.length) {
        return await base44.asServiceRole.entities[MIRROR_ENTITY].update(existing[0].id, data);
      }
      return await base44.asServiceRole.entities[MIRROR_ENTITY].create(data);
    };

    const listMirrorRecords = async (limit = 1000) => {
      return await base44.asServiceRole.entities[MIRROR_ENTITY].list('-updated_date', limit);
    };

    const syncFromAirtable = async () => {
      const orgFields = await getOrgFields();
      const existingMirror = await listMirrorRecords(5000);
      const existingByAirtableId = new Map(existingMirror.map(record => [record.airtable_record_id, record]));
      const airtableIds = new Set();
      const recordsToCreate = [];
      const recordsToUpdate = [];
      let offset = null;

      do {
        const params = new URLSearchParams({ pageSize: '100' });
        if (offset) params.set('offset', offset);
        const res = await fetch(`${AIRTABLE_URL}?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Airtable sync failed');

        for (const record of (data.records || [])) {
          airtableIds.add(record.id);
          const mirrorData = toMirrorRecord(record, orgFields);
          const existing = existingByAirtableId.get(record.id);
          if (!existing) {
            recordsToCreate.push(mirrorData);
          } else if (JSON.stringify(existing.fields || {}) !== JSON.stringify(mirrorData.fields || {})) {
            recordsToUpdate.push({ id: existing.id, data: mirrorData });
          }
        }
        offset = data.offset || null;
      } while (offset);

      let created = 0;
      for (let i = 0; i < recordsToCreate.length; i += 50) {
        const batch = recordsToCreate.slice(i, i + 50);
        await base44.asServiceRole.entities[MIRROR_ENTITY].bulkCreate(batch);
        created += batch.length;
      }

      let updated = 0;
      for (const item of recordsToUpdate.slice(0, 50)) {
        await base44.asServiceRole.entities[MIRROR_ENTITY].update(item.id, item.data);
        updated += 1;
      }

      let removed = 0;
      for (const mirror of existingMirror) {
        if (!airtableIds.has(mirror.airtable_record_id)) {
          await base44.asServiceRole.entities[MIRROR_ENTITY].delete(mirror.id);
          removed += 1;
        }
      }

      return { synced: airtableIds.size, created, updated, pending_updates: Math.max(recordsToUpdate.length - updated, 0), removed };
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
      const table = await getTableSchema();
      const biometricsField = pickField(table.fields || [], ['Biometrics Number', 'BIOMETRICS NUMBER', 'Biometric Number', 'Biometrics No']);
      if (!biometricsField) throw new Error('Biometrics Number column was not found in Airtable.');

      const res = await fetch(`${AIRTABLE_URL}/${airtableRecordId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: { [biometricsField]: String(employeeNumber) }, typecast: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Airtable biometrics update failed');
      const mirrored = await upsertMirrorRecord(data, orgFields);

      const fields = data.fields || {};
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

    if (action === 'employeeAccounts') {
      await syncFromAirtable();
      const allRecords = await listMirrorRecords(5000);
      const accounts = allRecords.map(record => {
        const fields = record.fields || {};
        return {
          airtable_record_id: record.airtable_record_id,
          full_name: record.full_name || fields['Full Name'],
          email: fields['Email'] || fields['Business email'],
          employee_code: fields['Employee Code'] || fields['Employee Code ID'] || record.employee_code,
          generated_password: generatedPassword(fields),
          job_title: fields['Job Title'],
          status: isActive(record) ? 'active' : 'inactive',
        };
      });
      return Response.json({ accounts });
    }

    if (action === 'employeeAccessStatus') {
      await syncFromAirtable();
      const currentUser = await base44.auth.me();
      if (currentUser.role === 'admin') return Response.json({ allowed: true, admin: true });
      if (!currentUser.employee_access_verified || !currentUser.employee_code) return Response.json({ allowed: false });
      const allRecords = await listMirrorRecords(5000);
      const matched = allRecords.find(record => clean(record.fields?.['Employee Code'] || record.fields?.['Employee Code ID'] || record.employee_code).toLowerCase() === clean(currentUser.employee_code).toLowerCase());
      if (!matched || !isActive(matched)) {
        await base44.auth.updateMe({ employee_access_verified: false, employee_account_status: 'disabled' });
        return Response.json({ allowed: false, message: 'Your employee account is no longer active. Please contact HR.' });
      }
      return Response.json({ allowed: true });
    }

    if (action === 'validateEmployeeAccess') {
      await syncFromAirtable();
      const { employeeCode, password } = body;
      const currentUser = await base44.auth.me();
      const allRecords = await listMirrorRecords(5000);
      const matched = allRecords.find(record => clean(record.fields?.['Employee Code'] || record.fields?.['Employee Code ID'] || record.employee_code).toLowerCase() === clean(employeeCode).toLowerCase());
      if (!matched || !isActive(matched)) return Response.json({ allowed: false, message: 'Employee account is inactive or not found.' });
      const fields = matched.fields || {};
      const recordEmail = clean(fields['Email'] || fields['Business email']).toLowerCase();
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
      const table = await getTableSchema();
      const COMPUTED_TYPES = new Set(['formula', 'rollup', 'lookup', 'count', 'autoNumber', 'createdTime', 'lastModifiedTime', 'createdBy', 'lastModifiedBy', 'externalSyncSource', 'aiText', 'button']);
      const computedFields = (table.fields || []).filter(f => COMPUTED_TYPES.has(f.type)).map(f => f.name);
      const fieldsMeta = {};
      for (const f of (table.fields || [])) {
        fieldsMeta[f.name] = (f.type === 'singleSelect' || f.type === 'multipleSelects')
          ? { type: f.type, choices: (f.options?.choices || []).map(c => ({ name: c.name, color: c.color || null })) }
          : { type: f.type };
      }
      return Response.json({ computedFields, fieldsMeta });
    }

    if (action === 'syncFromAirtable') {
      return Response.json(await syncFromAirtable());
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
      const allRecords = await listMirrorRecords(5000);
      const activeRecords = allRecords.filter(isNotResigned);
      const filtered = search?.trim()
        ? activeRecords.filter(record => String(record.search_text || '').includes(search.trim().toLowerCase()))
        : activeRecords;
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

    if (action === 'create') {
      const { fields } = body;
      const res = await fetch(AIRTABLE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields, typecast: true }),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });
      const mirrored = await upsertMirrorRecord(data, await getOrgFields());
      return Response.json({ record: { id: data.id, fields: data.fields, backend_id: mirrored.id } });
    }

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
      const mirrored = await upsertMirrorRecord(data, await getOrgFields());
      return Response.json({ record: { id: data.id, fields: data.fields, backend_id: mirrored.id } });
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
      if (!targetField) return Response.json({ error: `Airtable column for ${category.replace('_', ' ')} was not found.` }, { status: 404 });

      const fields = { [targetField]: String(target.name || '').trim() };
      if (orgFields.company && target.company_name) fields[orgFields.company] = String(target.company_name).trim();
      if (orgFields.branch && target.branch_name) fields[orgFields.branch] = String(target.branch_name).trim();
      if (orgFields.department && target.department_name) fields[orgFields.department] = String(target.department_name).trim();

      const res = await fetch(`${AIRTABLE_URL}/${recordId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields, typecast: true }),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable update failed', details: data }, { status: res.status });
      const mirrored = await upsertMirrorRecord(data, orgFields);
      return Response.json({ record: { id: data.id, fields: data.fields, backend_id: mirrored.id } });
    }

    if (action === 'updateCompanyForBranch') {
      const { branchName, companyName } = body;
      const cleanBranch = String(branchName || '').trim();
      const cleanCompany = String(companyName || '').trim();
      if (!cleanBranch || !cleanCompany) return Response.json({ error: 'branchName and companyName are required' }, { status: 400 });

      const orgFields = await getOrgFields();
      if (!orgFields.company || !orgFields.branch) return Response.json({ error: 'Company or Branch column was not found in Airtable.' }, { status: 404 });
      const recordsToUpdate = [];
      let offset = null;
      do {
        const params = new URLSearchParams({ pageSize: '100' });
        params.append('fields[]', orgFields.branch);
        params.append('fields[]', orgFields.company);
        params.set('filterByFormula', `{${orgFields.branch}} = "${cleanBranch.replace(/"/g, '\\"')}"`);
        if (offset) params.set('offset', offset);
        const res = await fetch(`${AIRTABLE_URL}?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });
        recordsToUpdate.push(...(data.records || []).filter(record => record.fields?.[orgFields.company] !== cleanCompany));
        offset = data.offset || null;
      } while (offset);

      for (let i = 0; i < recordsToUpdate.length; i += 10) {
        const batch = recordsToUpdate.slice(i, i + 10).map(record => ({ id: record.id, fields: { [orgFields.company]: cleanCompany } }));
        const res = await fetch(AIRTABLE_URL, { method: 'PATCH', headers, body: JSON.stringify({ records: batch, typecast: true }) });
        const data = await res.json();
        if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable update failed', details: data }, { status: res.status });
        for (const record of (data.records || [])) await upsertMirrorRecord(record, orgFields);
      }

      return Response.json({ updated: recordsToUpdate.length });
    }

    if (action === 'renameField') {
      const { fieldId, fieldName, newName } = body;
      if (!newName) return Response.json({ error: 'newName required' }, { status: 400 });
      const table = await getTableSchema();
      const resolvedId = fieldId || (table.fields || []).find(f => f.name === fieldName)?.id;
      if (!resolvedId) return Response.json({ error: `Field "${fieldName}" not found` }, { status: 404 });
      const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields/${resolvedId}`, { method: 'PATCH', headers, body: JSON.stringify({ name: newName }) });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Rename failed', details: data }, { status: res.status });
      await syncFromAirtable();
      return Response.json({ field: data });
    }

    if (action === 'createField') {
      const { name, type = 'singleLineText', options } = body;
      const cleanName = String(name || '').trim();
      if (!cleanName) return Response.json({ error: 'Column name is required' }, { status: 400 });
      const table = await getTableSchema();
      const existingField = (table.fields || []).find(f => f.name.toLowerCase() === cleanName.toLowerCase());
      if (existingField) return Response.json({ error: `A column named "${existingField.name}" already exists in Airtable.` }, { status: 409 });
      const payload = { name: cleanName, type };
      if (options) payload.options = options;
      const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields`, { method: 'POST', headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || data.error?.type || 'Create field failed. Please check that your Airtable token has schema write permission.', details: data }, { status: res.status });
      return Response.json({ field: data });
    }

    if (action === 'delete') {
      const { recordId } = body;
      if (!recordId) return Response.json({ error: 'recordId required' }, { status: 400 });
      const res = await fetch(`${AIRTABLE_URL}/${recordId}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Airtable error', details: data }, { status: res.status });
      const existing = await base44.asServiceRole.entities[MIRROR_ENTITY].filter({ airtable_record_id: recordId }, '-updated_date', 10);
      for (const record of existing) await base44.asServiceRole.entities[MIRROR_ENTITY].delete(record.id);
      return Response.json({ deleted: true, id: data.id });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
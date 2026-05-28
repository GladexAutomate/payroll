import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function cleanText(value) { return String(value || '').trim(); }
function normalizeName(value) { return cleanText(value).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function parseMoney(value) {
  const number = Number(cleanText(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}
function money(value) { return Math.round(Number(value || 0) * 100) / 100; }
function getFields(employee) { return employee?.fields || {}; }
function getEmployeeName(employee) {
  const fields = getFields(employee);
  return cleanText(employee.full_name || fields['Full Name'] || [fields['First Name'], fields['Middle Name'], fields['Last Name']].filter(Boolean).join(' '));
}
function getEmployeeCode(employee) {
  const fields = getFields(employee);
  return cleanText(employee.employee_code || fields['Employee Code ID'] || fields['Employee Code']);
}
function getBiometricNumber(employee) { return cleanText(getFields(employee)['Biometrics Number']); }
function isActiveEmployee(employee) { return cleanText(getFields(employee).Status).toLowerCase() === 'active'; }
function buildEmployeeKeys(employee) {
  return [employee.id, employee.airtable_record_id, getEmployeeCode(employee), getBiometricNumber(employee), normalizeName(getEmployeeName(employee))]
    .filter(Boolean)
    .map(key => String(key).trim());
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function withRetry(operation, attempts = 8) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      if (!message.includes('429') && !message.toLowerCase().includes('rate limit')) throw error;
      await wait(1200 * (i + 1));
    }
  }
  throw lastError;
}
async function bulkCreateInChunks(entity, records, size = 25) {
  for (let i = 0; i < records.length; i += size) {
    await withRetry(() => entity.bulkCreate(records.slice(i, i + size)));
    await wait(250);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { period_start, period_end, period_label } = body;
    if (!period_start || !period_end) return Response.json({ error: 'period_start and period_end required' }, { status: 400 });

    const allEmployees = await withRetry(() => base44.asServiceRole.entities.AirtableEmployeeRecord.list('-updated_date', 5000));
    await wait(600);
    const localEmployees = await withRetry(() => base44.asServiceRole.entities.Employee.list('-updated_date', 5000));
    await wait(600);
    const savedMatches = await withRetry(() => base44.asServiceRole.entities.EmployeeAirtableMatch.list('-updated_date', 5000));
    await wait(600);
    const hiddenUploads = await withRetry(() => base44.asServiceRole.entities.AttendanceUpload.list('-created_date', 200));
    await wait(600);
    const allLogs = await withRetry(() => base44.asServiceRole.entities.AttendanceLog.filter({ date: { $gte: period_start, $lte: period_end } }, 'date', 5000));
    await wait(600);
    const existingSummaries = await withRetry(() => base44.asServiceRole.entities.AttendancePaySummary.filter({ period_start, period_end }, '-created_date', 5000));

    const activeUploadIds = new Set(hiddenUploads.filter(upload => !['deleting', 'deleted'].includes(upload.status)).map(upload => upload.id));
    const logs = allLogs.filter(log => !log.upload_id || activeUploadIds.has(log.upload_id));
    const employees = allEmployees.filter(isActiveEmployee);
    const existingByEmployeeId = existingSummaries.reduce((map, record) => ({ ...map, [record.employee_id]: record }), {});
    const localEmployeeMap = localEmployees.reduce((map, employee) => ({ ...map, [employee.id]: employee }), {});
    const airtableByLocalId = savedMatches.reduce((map, match) => ({ ...map, [match.employee_record_id]: match.airtable_record_id }), {});
    for (const local of localEmployees) {
      const localName = normalizeName([local.first_name, local.middle_name, local.last_name].filter(Boolean).join(' '));
      const matched = employees.find(employee => normalizeName(getEmployeeName(employee)) === localName);
      if (matched) airtableByLocalId[local.id] = matched.airtable_record_id;
    }
    const airtableEmployeeMap = employees.reduce((map, employee) => ({ ...map, [employee.airtable_record_id]: employee }), {});
    const recordsToCreate = [];
    const recordsToUpdate = [];
    const computedAt = new Date().toISOString();

    for (const employee of employees) {
      const fields = getFields(employee);
      const monthlySalary = parseMoney(fields['Monthly Salary'] || fields['Basic Salary'] || fields.Salary);
      const hourlyRate = monthlySalary > 0 ? monthlySalary / 26 / 8 : 0;
      const keys = new Set(buildEmployeeKeys(employee));
      for (const [localId, airtableId] of Object.entries(airtableByLocalId)) {
        if (airtableId !== employee.airtable_record_id) continue;
        const local = localEmployeeMap[localId];
        keys.add(localId);
        if (local?.employee_id) keys.add(cleanText(local.employee_id));
        if (local?.biometric_id) keys.add(cleanText(local.biometric_id));
        if (local) keys.add(normalizeName([local.first_name, local.middle_name, local.last_name].filter(Boolean).join(' ')));
      }
      const employeeLogs = logs.filter(log =>
        keys.has(cleanText(log.employee_id)) ||
        keys.has(cleanText(log.biometric_id)) ||
        keys.has(normalizeName(log.employee_name))
      );

      let hours = 0;
      let overtimeHours = 0;
      let lateMinutes = 0;
      for (const log of employeeLogs) {
        if (!log.time_in || !log.time_out) continue;
        const workedHours = Number(log.total_hours) || 0;
        if (workedHours <= 0) continue;
        hours += Math.min(workedHours, 8);
        overtimeHours += Math.max(workedHours - 8, 0);
        lateMinutes += Number(log.late_minutes) || 0;
      }

      const gross = (hours * hourlyRate) + (overtimeHours * hourlyRate * 1.25);
      const latesDeduction = (lateMinutes / 60) * hourlyRate;
      const summary = {
        period_start,
        period_end,
        period_label: period_label || `${period_start} – ${period_end}`,
        employee_id: employee.id,
        airtable_record_id: employee.airtable_record_id,
        employee_code: getEmployeeCode(employee),
        employee_name: getEmployeeName(employee),
        hours: money(hours),
        overtime_hours: money(overtimeHours),
        late_minutes: lateMinutes,
        gross: money(gross),
        lates_deduction: money(latesDeduction),
        computed_at: computedAt,
      };

      const existing = existingByEmployeeId[employee.id];
      if (existing) recordsToUpdate.push({ id: existing.id, data: summary });
      else recordsToCreate.push(summary);
    }

    await bulkCreateInChunks(base44.asServiceRole.entities.AttendancePaySummary, recordsToCreate);
    for (const record of recordsToUpdate) {
      await withRetry(() => base44.asServiceRole.entities.AttendancePaySummary.update(record.id, record.data));
      await wait(120);
    }

    return Response.json({ success: true, count: employees.length, period_start, period_end });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
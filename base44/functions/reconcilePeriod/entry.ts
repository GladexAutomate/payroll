import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function cleanText(value) { return String(value || '').trim(); }
function normalizeName(value) { return cleanText(value).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function parseMoney(value) { const n = Number(cleanText(value).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
function money(value) { return Math.round(Number(value || 0) * 100) / 100; }
function getFields(e) { return e?.fields || {}; }
function getEmployeeName(e) {
  const f = getFields(e);
  return cleanText(e.full_name || f['Full Name'] || [f['First Name'], f['Middle Name'], f['Last Name']].filter(Boolean).join(' '));
}
function getEmployeeCode(e) { const f = getFields(e); return cleanText(e.employee_code || f['Employee Code ID'] || f['Employee Code']); }
function getBiometricNumber(e) { return cleanText(getFields(e)['Biometrics Number']); }
function isActiveEmployee(e) { return cleanText(getFields(e).Status).toLowerCase() === 'active'; }
function getMonthlySalary(e) { const f = getFields(e); return parseMoney(f['Monthly Salary'] || f['Basic Salary'] || f.Salary); }
function buildEmployeeKeys(e) {
  return [e.id, e.airtable_record_id, getEmployeeCode(e), getBiometricNumber(e), normalizeName(getEmployeeName(e))]
    .filter(Boolean).map(k => String(k).trim());
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function withRetry(op, attempts = 8) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try { return await op(); } catch (err) {
      last = err;
      const m = String(err?.message || '');
      if (!m.includes('429') && !m.toLowerCase().includes('rate limit')) throw err;
      await wait(1200 * (i + 1));
    }
  }
  throw last;
}
async function bulkCreateInChunks(entity, records, size = 25) {
  for (let i = 0; i < records.length; i += size) {
    await withRetry(() => entity.bulkCreate(records.slice(i, i + size)));
    await wait(250);
  }
}

// Schedule card categories
const PAID_LEAVE = new Set(['paid_vl', 'sick', 'maternity', 'paternity', 'emergency']);
const UNPAID_LEAVE = new Set(['unpaid_vl']);
const REST_TYPES = new Set(['off']);
const WORK_TYPES = new Set(['opener', 'closer', 'wfh']);

function eachDate(start, end) {
  const out = [];
  let d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (d <= last) { out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
  return out;
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
    await wait(400);
    const localEmployees = await withRetry(() => base44.asServiceRole.entities.Employee.list('-updated_date', 5000));
    await wait(400);
    const savedMatches = await withRetry(() => base44.asServiceRole.entities.EmployeeAirtableMatch.list('-updated_date', 5000));
    await wait(400);
    const hiddenUploads = await withRetry(() => base44.asServiceRole.entities.AttendanceUpload.list('-created_date', 200));
    await wait(400);
    const allLogs = await withRetry(() => base44.asServiceRole.entities.AttendanceLog.filter({ date: { $gte: period_start, $lte: period_end } }, 'date', 5000));
    await wait(400);
    const plotted = await withRetry(() => base44.asServiceRole.entities.ApprovedSchedule.filter({ date: { $gte: period_start, $lte: period_end } }, 'date', 5000));
    await wait(400);
    const holidays = await withRetry(() => base44.asServiceRole.entities.HolidayCalendar.list('-date', 500));
    await wait(400);
    const existing = await withRetry(() => base44.asServiceRole.entities.AttendancePaySummary.filter({ period_start, period_end }, '-created_date', 5000));

    const activeUploadIds = new Set(hiddenUploads.filter(u => !['deleting', 'deleted'].includes(u.status)).map(u => u.id));
    const logs = allLogs.filter(l => !l.upload_id || activeUploadIds.has(l.upload_id));
    const employees = allEmployees.filter(isActiveEmployee);

    // Holiday lookup by date -> 'regular' | 'special'
    const holidayByDate = {};
    holidays.forEach(h => { holidayByDate[h.date] = (h.type === 'regular') ? 'regular' : 'special'; });

    // Plotted schedule lookup: employee_id -> { date -> schedule_type }
    const scheduleByEmp = {};
    plotted.forEach(rec => {
      scheduleByEmp[rec.employee_id] = scheduleByEmp[rec.employee_id] || {};
      scheduleByEmp[rec.employee_id][rec.date] = rec.schedule_type;
    });

    const localEmployeeMap = localEmployees.reduce((m, e) => ({ ...m, [e.id]: e }), {});
    const airtableByLocalId = savedMatches.reduce((m, mt) => ({ ...m, [mt.employee_record_id]: mt.airtable_record_id }), {});
    for (const local of localEmployees) {
      const localName = normalizeName([local.first_name, local.middle_name, local.last_name].filter(Boolean).join(' '));
      const matched = employees.find(e => normalizeName(getEmployeeName(e)) === localName);
      if (matched) airtableByLocalId[local.id] = matched.airtable_record_id;
    }
    const existingByEmpId = existing.reduce((m, r) => ({ ...m, [r.employee_id]: r }), {});

    const dates = eachDate(period_start, period_end);
    const recordsToCreate = [];
    const recordsToUpdate = [];
    const computedAt = new Date().toISOString();

    for (const employee of employees) {
      const monthlySalary = getMonthlySalary(employee);
      const dailyRate = monthlySalary > 0 ? monthlySalary / 26 : 0;
      const hourlyRate = dailyRate / 8;

      const keys = new Set(buildEmployeeKeys(employee));
      for (const [localId, airtableId] of Object.entries(airtableByLocalId)) {
        if (airtableId !== employee.airtable_record_id) continue;
        const local = localEmployeeMap[localId];
        keys.add(localId);
        if (local?.employee_id) keys.add(cleanText(local.employee_id));
        if (local?.biometric_id) keys.add(cleanText(local.biometric_id));
        if (local) keys.add(normalizeName([local.first_name, local.middle_name, local.last_name].filter(Boolean).join(' ')));
      }

      // Index this employee's logs by date
      const logsByDate = {};
      logs.forEach(l => {
        if (keys.has(cleanText(l.employee_id)) || keys.has(cleanText(l.biometric_id)) || keys.has(normalizeName(l.employee_name))) {
          logsByDate[l.date] = l;
        }
      });

      const sched = scheduleByEmp[employee.id] || {};

      let regularHours = 0, overtimeHours = 0, lateMinutes = 0;
      let regularPay = 0, overtimePay = 0, holidayPay = 0, leavePay = 0;
      let daysWorked = 0, daysAbsent = 0, paidLeaveDays = 0;

      for (const date of dates) {
        const schedType = sched[date] || 'none';
        const log = logsByDate[date];
        const holiday = holidayByDate[date]; // 'regular' | 'special' | undefined

        // Worked hours from punches
        let worked = 0;
        if (log?.time_in && log?.time_out) {
          worked = (new Date(log.time_out) - new Date(log.time_in)) / 3600000;
          if (!Number.isFinite(worked) || worked <= 0) worked = Number(log.total_hours) || 0;
        }
        const hasPunch = worked > 0;
        const reg = hasPunch ? Math.max(1, Math.min(worked, 8)) : 0;
        const extra = hasPunch ? Math.max(0, worked - 8) : 0;
        const ot = extra >= 1 ? Math.floor(extra) : 0;
        const lateMin = Number(log?.late_minutes) || 0;

        // 1. Paid leave -> pay full 8h regardless of punch
        if (PAID_LEAVE.has(schedType)) {
          leavePay += dailyRate;
          paidLeaveDays += 1;
          continue;
        }
        // 2. Unpaid leave -> no pay, not absent
        if (UNPAID_LEAVE.has(schedType)) continue;

        // 3. Rest day (Off)
        if (REST_TYPES.has(schedType)) {
          if (hasPunch) {
            // Rest-day work -> 130% (or holiday premium if higher)
            const mult = holiday === 'regular' ? 2.0 : holiday === 'special' ? 1.5 : 1.3;
            const dayPay = reg * hourlyRate * mult;
            holidayPay += dayPay;
            regularHours += reg;
            overtimeHours += ot;
            overtimePay += ot * hourlyRate * mult;
            daysWorked += 1;
            lateMinutes += lateMin;
          }
          continue; // rest day, no punch -> nothing
        }

        // 4. Scheduled work day (opener/closer/wfh) OR no schedule
        const isScheduledWork = WORK_TYPES.has(schedType);
        if (hasPunch) {
          daysWorked += 1;
          regularHours += reg;
          overtimeHours += ot;
          lateMinutes += lateMin;
          if (holiday === 'regular') {
            holidayPay += reg * hourlyRate * 2.0;
            overtimePay += ot * hourlyRate * 2.0;
          } else if (holiday === 'special') {
            holidayPay += reg * hourlyRate * 1.3;
            overtimePay += ot * hourlyRate * 1.3;
          } else {
            regularPay += reg * hourlyRate;
            overtimePay += ot * hourlyRate * 1.25;
          }
        } else if (isScheduledWork) {
          // Scheduled to work, no punch -> mark absent (no pay)
          daysAbsent += 1;
        }
        // no schedule + no punch -> ignore
      }

      const latesDeduction = (lateMinutes / 60) * hourlyRate;
      const gross = money(regularPay + overtimePay + holidayPay + leavePay);

      const summary = {
        period_start,
        period_end,
        period_label: period_label || `${period_start} – ${period_end}`,
        employee_id: employee.id,
        airtable_record_id: employee.airtable_record_id,
        employee_code: getEmployeeCode(employee),
        employee_name: getEmployeeName(employee),
        hours: money(regularHours),
        overtime_hours: money(overtimeHours),
        late_minutes: lateMinutes,
        gross,
        lates_deduction: money(latesDeduction),
        days_worked: daysWorked,
        days_absent: daysAbsent,
        paid_leave_days: paidLeaveDays,
        regular_pay: money(regularPay),
        overtime_pay: money(overtimePay),
        holiday_pay: money(holidayPay),
        leave_pay: money(leavePay),
        computed_at: computedAt,
      };

      const ex = existingByEmpId[employee.id];
      if (ex) recordsToUpdate.push({ id: ex.id, data: summary });
      else recordsToCreate.push(summary);
    }

    await bulkCreateInChunks(base44.asServiceRole.entities.AttendancePaySummary, recordsToCreate);
    for (const r of recordsToUpdate) {
      await withRetry(() => base44.asServiceRole.entities.AttendancePaySummary.update(r.id, r.data));
      await wait(120);
    }

    return Response.json({ success: true, count: employees.length, period_start, period_end });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
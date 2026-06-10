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
function getMonthlySalary(e) { const f = getFields(e); return parseMoney(f['Basic Salary'] || f['Monthly Salary'] || f.Salary); }
function buildEmployeeKeys(e) {
  return [e.id, e.airtable_record_id, getEmployeeCode(e), getBiometricNumber(e), normalizeName(getEmployeeName(e))]
    .filter(Boolean).map(k => String(k).trim());
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function withRetry(op, attempts = 12) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try { return await op(); } catch (err) {
      last = err;
      const m = String(err?.message || '');
      if (!m.includes('429') && !m.toLowerCase().includes('rate limit')) throw err;
      // Exponential backoff with jitter, capped at ~15s, so colliding runs back off instead of dying.
      const backoff = Math.min(15000, 1000 * Math.pow(1.6, i)) + Math.floor(Math.random() * 500);
      await wait(backoff);
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

const POLICY_DEFAULTS = {
  mandatory_break_minutes: 60,
  standard_work_hours: 8,
  grace_period_minutes: 15,
  deduct_undertime: true,
  ot_multiplier_regular: 1.25,
  ot_multiplier_rest_day: 1.3,
  ot_multiplier_rest_day_excess: 1.69,
  multiplier_regular_holiday: 2.0,
  ot_multiplier_regular_holiday: 2.6,
  multiplier_special_holiday: 1.3,
  ot_multiplier_special_holiday: 1.69,
  night_diff_enabled: true,
  night_diff_rate: 0.1,
  night_diff_start: '22:00',
  night_diff_end: '06:00',
  rest_day_work_requires_approval: true,
  thirteenth_month_enabled: true,
  working_days_divisor: 26,
};

function eachDate(start, end) {
  const out = [];
  let d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (d <= last) { out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
  return out;
}

function hmToMinutes(hm) {
  const [h, m] = String(hm || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

// Count hours of a worked interval that fall within the night-diff window (handles overnight wrap)
function nightDiffHours(timeIn, timeOut, startHm, endHm) {
  const inDate = new Date(timeIn);
  const outDate = new Date(timeOut);
  if (!(inDate < outDate)) return 0;
  const startMin = hmToMinutes(startHm); // e.g. 22:00 -> 1320
  const endMin = hmToMinutes(endHm);     // e.g. 06:00 -> 360
  let overlapMs = 0;
  // Walk minute-by-day windows across the shift span (cheap: shifts are < ~16h)
  let cursor = new Date(inDate);
  while (cursor < outDate) {
    const dayStart = new Date(cursor); dayStart.setHours(0, 0, 0, 0);
    // Window 1: [startMin, 24:00)
    const winAStart = new Date(dayStart.getTime() + startMin * 60000);
    const winAEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);
    // Window 2: [00:00, endMin)
    const winBStart = new Date(dayStart);
    const winBEnd = new Date(dayStart.getTime() + endMin * 60000);
    for (const [ws, we] of [[winAStart, winAEnd], [winBStart, winBEnd]]) {
      const s = Math.max(inDate.getTime(), ws.getTime());
      const e = Math.min(outDate.getTime(), we.getTime());
      if (e > s) overlapMs += e - s;
    }
    cursor = new Date(dayStart.getTime() + 24 * 60 * 60000);
  }
  return overlapMs / 3600000;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, period_start, period_end, period_label, branch_filter } = body;

    // History list: read runs via service role (runs are created by the service account,
    // so user-scoped reads would otherwise return nothing).
    if (action === 'list_runs') {
      const runs = await withRetry(() => base44.asServiceRole.entities.ReconciliationRun.list('-started_at', 50));
      return Response.json({ runs });
    }

    if (!period_start || !period_end) return Response.json({ error: 'period_start and period_end required' }, { status: 400 });
    const branchScope = cleanText(branch_filter);
    const runStartedAt = new Date();

    // Create a history record up front so the UI can poll progress.
    const run = await withRetry(() => base44.asServiceRole.entities.ReconciliationRun.create({
      period_start, period_end,
      period_label: period_label || `${period_start} – ${period_end}`,
      branch_filter: branchScope || 'all',
      status: 'processing', progress: 0, processed: 0, total: 0,
      run_by: cleanText(user.email),
      started_at: runStartedAt.toISOString(),
    }));

    // Process in the background so the request returns the run id immediately and the
    // UI can poll progress live instead of waiting for the whole computation.
    const work = processReconciliation({ base44, run, runStartedAt, period_start, period_end, period_label, branchScope });
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(work.catch(() => {}));
    } else {
      work.catch(() => {});
    }
    return Response.json({ success: true, run_id: run.id, started: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function processReconciliation({ base44, run, runStartedAt, period_start, period_end, period_label, branchScope }) {
  try {
    // Editable payroll policy (singleton)
    const policyRows = await withRetry(() => base44.asServiceRole.entities.PayrollPolicy.filter({ key: 'default' }));
    const P = { ...POLICY_DEFAULTS, ...(policyRows[0] || {}) };
    await wait(200);

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
    await wait(400);
    // Only APPROVED overtime within the period is paid. Unfiled / pending / rejected OT is ignored.
    const approvedOT = await withRetry(() => base44.asServiceRole.entities.OvertimeRequest.filter({ status: 'approved', date: { $gte: period_start, $lte: period_end } }, 'date', 5000));
    await wait(300);
    // Approved offsets within the period
    const approvedOffsets = await withRetry(() => base44.asServiceRole.entities.OffsetRequest.filter({ status: 'approved', offset_date: { $gte: period_start, $lte: period_end } }, 'offset_date', 5000));
    await wait(300);
    // Approved leave requests (paid leaves are paid even when not plotted on the approved schedule)
    const approvedLeaves = await withRetry(() => base44.asServiceRole.entities.LeaveRequest.filter({ status: 'approved' }, '-date_from', 5000));
    await wait(300);
    // Active allowances & ATD charges
    const adjustments = await withRetry(() => base44.asServiceRole.entities.EmployeeDeduction.list('-created_date', 5000));

    const activeUploadIds = new Set(hiddenUploads.filter(u => !['deleting', 'deleted'].includes(u.status)).map(u => u.id));
    const logs = allLogs.filter(l => !l.upload_id || activeUploadIds.has(l.upload_id));
    const branchOf = (e) => cleanText(getFields(e).Branch || getFields(e).BRANCH);
    const employees = allEmployees
      .filter(isActiveEmployee)
      .filter(e => !branchScope || branchScope === 'all' || branchOf(e).toLowerCase() === branchScope.toLowerCase());

    // Holiday lookup by date -> 'regular' | 'special'
    const holidayByDate = {};
    holidays.forEach(h => { holidayByDate[h.date] = (h.type === 'regular') ? 'regular' : 'special'; });

    // Plotted schedule lookup: employee_id -> { date -> schedule_type }
    const scheduleByEmp = {};
    plotted.forEach(rec => {
      scheduleByEmp[rec.employee_id] = scheduleByEmp[rec.employee_id] || {};
      scheduleByEmp[rec.employee_id][rec.date] = rec.schedule_type;
    });

    // Approved OT lookup: employeeKey -> { date -> approved_hours }
    const approvedOTByKey = {};
    approvedOT.forEach(ot => {
      const key = cleanText(ot.employee_id);
      if (!key) return;
      approvedOTByKey[key] = approvedOTByKey[key] || {};
      const hrs = Number(ot.approved_hours);
      approvedOTByKey[key][ot.date] = Number.isFinite(hrs) ? hrs : (Number(ot.requested_hours) || 0);
    });

    // Approved rest-day OT dates (for rest_day_work_requires_approval)
    const restDayApprovedByKey = {};
    approvedOT.forEach(ot => {
      const key = cleanText(ot.employee_id);
      if (!key) return;
      restDayApprovedByKey[key] = restDayApprovedByKey[key] || new Set();
      restDayApprovedByKey[key].add(ot.date);
    });

    // Approved leave lookup: employeeKey -> { date -> 'paid' | 'unpaid' }
    // Expands each leave request across its date range and tags each day paid/unpaid.
    const leaveByKey = {};
    approvedLeaves.forEach(lv => {
      const key = cleanText(lv.employee_id);
      if (!key || !lv.date_from || !lv.date_to) return;
      const isPaid = lv.is_paid !== false && lv.leave_type !== 'unpaid';
      leaveByKey[key] = leaveByKey[key] || {};
      eachDate(lv.date_from, lv.date_to).forEach(d => {
        if (d >= period_start && d <= period_end) leaveByKey[key][d] = isPaid ? 'paid' : 'unpaid';
      });
    });

    // Approved offset hours: employeeKey -> { date -> offset_hours }
    const offsetByKey = {};
    approvedOffsets.forEach(o => {
      const key = cleanText(o.employee_id);
      if (!key) return;
      offsetByKey[key] = offsetByKey[key] || {};
      offsetByKey[key][o.offset_date] = (offsetByKey[key][o.offset_date] || 0) + (Number(o.offset_hours) || 0);
    });

    // Allowances & active ATD charges per employee key
    const allowanceByKey = {};
    const chargeByKey = {};
    adjustments.forEach(a => {
      const key = cleanText(a.employee_id);
      if (!key) return;
      if (a.kind === 'allowance' && (a.atd_status === 'active' || a.recurring)) {
        // Recurring allowances apply every cutoff once started; respect start_date if set
        const started = !a.start_date || a.start_date <= period_end;
        if (started) allowanceByKey[key] = (allowanceByKey[key] || 0) + (Number(a.amount_per_cutoff) || 0);
      } else if (a.kind === 'deduction' && a.atd_status === 'active') {
        // Only deduct if started and not yet completed
        const started = !a.start_date || a.start_date <= period_end;
        const remaining = a.recurring ? Infinity : Math.max(0, (Number(a.total_cutoffs) || 0) - (Number(a.cutoffs_paid) || 0));
        if (started && remaining > 0) {
          chargeByKey[key] = (chargeByKey[key] || 0) + (Number(a.amount_per_cutoff) || 0);
        }
      }
    });

    const localEmployeeMap = localEmployees.reduce((m, e) => ({ ...m, [e.id]: e }), {});
    const airtableByLocalId = savedMatches.reduce((m, mt) => ({ ...m, [mt.employee_record_id]: mt.airtable_record_id }), {});
    // Index Airtable employees by biometric number, employee code, and normalized name for robust matching.
    const airtableByBio = {};
    const airtableByCode = {};
    const airtableByName = {};
    employees.forEach(e => {
      const bio = cleanText(getBiometricNumber(e));
      const code = cleanText(getEmployeeCode(e)).toLowerCase();
      const nm = normalizeName(getEmployeeName(e));
      if (bio) airtableByBio[bio] = e.airtable_record_id;
      if (code) airtableByCode[code] = e.airtable_record_id;
      if (nm) airtableByName[nm] = e.airtable_record_id;
    });
    for (const local of localEmployees) {
      if (airtableByLocalId[local.id]) continue; // saved match wins
      const bio = cleanText(local.biometric_id || local.employee_id);
      const code = cleanText(local.employee_id).toLowerCase();
      const localName = normalizeName([local.first_name, local.middle_name, local.last_name].filter(Boolean).join(' '));
      // Prefer biometric number, then employee code, then exact normalized name.
      const matchId = (bio && airtableByBio[bio]) || (code && airtableByCode[code]) || airtableByName[localName];
      if (matchId) airtableByLocalId[local.id] = matchId;
    }
    const existingByEmpId = existing.reduce((m, r) => ({ ...m, [r.employee_id]: r }), {});

    const dates = eachDate(period_start, period_end);
    const STD = P.standard_work_hours || 8;
    const BREAK_H = (P.mandatory_break_minutes || 0) / 60;
    const recordsToCreate = [];
    const recordsToUpdate = [];
    const computedAt = new Date().toISOString();

    // Running totals for the history record
    let totalGross = 0, totalAllowances = 0, totalDeductions = 0, totalAbsentDays = 0;
    let processed = 0;
    const totalEmployees = employees.length;
    await withRetry(() => base44.asServiceRole.entities.ReconciliationRun.update(run.id, { total: totalEmployees }));

    for (const employee of employees) {
      const monthlySalary = getMonthlySalary(employee);
      const dailyRate = monthlySalary > 0 ? monthlySalary / (P.working_days_divisor || 26) : 0;
      const hourlyRate = dailyRate / STD;

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

      // Merge per-key lookups for this employee
      const approvedOTForEmp = {};
      const restDayApprovedForEmp = new Set();
      const offsetForEmp = {};
      const leaveForEmp = {};
      let allowanceTotal = 0;
      let chargeTotal = 0;
      keys.forEach(k => {
        const ck = cleanText(k);
        const byDate = approvedOTByKey[ck];
        if (byDate) Object.entries(byDate).forEach(([d, h]) => { approvedOTForEmp[d] = Math.max(approvedOTForEmp[d] || 0, h); });
        const rd = restDayApprovedByKey[ck];
        if (rd) rd.forEach(d => restDayApprovedForEmp.add(d));
        const off = offsetByKey[ck];
        if (off) Object.entries(off).forEach(([d, h]) => { offsetForEmp[d] = Math.max(offsetForEmp[d] || 0, h); });
        const lv = leaveByKey[ck];
        if (lv) Object.entries(lv).forEach(([d, kind]) => { if (!leaveForEmp[d]) leaveForEmp[d] = kind; });
        allowanceTotal = Math.max(allowanceTotal, allowanceByKey[ck] || 0);
        chargeTotal = Math.max(chargeTotal, chargeByKey[ck] || 0);
      });

      // OT bank: total approved OT this period (used to validate offsets)
      let otBank = Object.values(approvedOTForEmp).reduce((s, h) => s + h, 0);

      let regularHours = 0, overtimeHours = 0, lateMinutes = 0, undertimeMinutes = 0, offsetHoursUsed = 0;
      let nightHours = 0, nightPay = 0;
      let regularPay = 0, overtimePay = 0, holidayPay = 0, leavePay = 0;
      let daysWorked = 0, daysAbsent = 0, paidLeaveDays = 0;

      for (const date of dates) {
        const schedType = sched[date] || 'none';
        const log = logsByDate[date];
        const holiday = holidayByDate[date]; // 'regular' | 'special' | undefined
        const leaveKind = leaveForEmp[date]; // 'paid' | 'unpaid' | undefined (from approved LeaveRequest)

        // Approved leave from LeaveRequest takes precedence (filed leaves are honored even
        // when the schedule wasn't plotted). Skip if the schedule already marks paid leave to avoid double pay.
        if (leaveKind && !PAID_LEAVE.has(schedType) && !UNPAID_LEAVE.has(schedType)) {
          if (leaveKind === 'paid') { leavePay += dailyRate; paidLeaveDays += 1; }
          continue; // paid or unpaid: the day is consumed by leave, no absence/punch processing
        }

        // Resolve in/out: prefer explicit fields, else reconstruct from raw_punches
        // (handles corrupt manually-edited logs with null time_in/out but valid punches).
        let timeIn = log?.time_in;
        let timeOut = log?.time_out;
        if ((!timeIn || !timeOut) && Array.isArray(log?.raw_punches) && log.raw_punches.length >= 2) {
          const sorted = [...log.raw_punches].filter(Boolean).sort();
          timeIn = timeIn || sorted[0];
          timeOut = timeOut || sorted[sorted.length - 1];
        }

        // Gross punch span, then subtract the mandatory unpaid break
        let span = 0;
        if (timeIn && timeOut) {
          span = (new Date(timeOut) - new Date(timeIn)) / 3600000;
          if (!Number.isFinite(span) || span <= 0) span = Number(log?.total_hours) || 0;
        } else if (Number(log?.total_hours) > 0) {
          span = Number(log.total_hours);
        }
        const hasPunch = span > 0;
        // Net worked hours = span - break (only deduct break when worked beyond the break length)
        const worked = hasPunch ? Math.max(0, span - (span > BREAK_H ? BREAK_H : 0)) : 0;

        const lateMin = Number(log?.late_minutes) || 0;
        const nd = (P.night_diff_enabled && hasPunch && timeIn && timeOut)
          ? nightDiffHours(timeIn, timeOut, P.night_diff_start, P.night_diff_end) : 0;

        // 1. Paid leave -> pay full standard day regardless of punch
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
            // Rest-day work optionally requires an approved OT request for that date
            if (P.rest_day_work_requires_approval && !restDayApprovedForEmp.has(date)) {
              continue; // not approved -> not paid
            }
            const reg = Math.min(worked, STD);
            const extra = Math.max(0, worked - STD);
            const approvedOTHours = approvedOTForEmp[date] || 0;
            const ot = Math.min(extra >= 1 ? Math.floor(extra) : 0, approvedOTHours);
            const baseMult = holiday === 'regular' ? P.multiplier_regular_holiday
              : holiday === 'special' ? P.multiplier_special_holiday : P.ot_multiplier_rest_day;
            const otMult = holiday === 'regular' ? P.ot_multiplier_regular_holiday
              : holiday === 'special' ? P.ot_multiplier_special_holiday : P.ot_multiplier_rest_day_excess;
            holidayPay += reg * hourlyRate * baseMult;
            overtimePay += ot * hourlyRate * otMult;
            regularHours += reg;
            overtimeHours += ot;
            daysWorked += 1;
            lateMinutes += lateMin;
            if (nd > 0) { nightHours += nd; nightPay += nd * hourlyRate * (P.night_diff_rate || 0); }
          }
          continue;
        }

        // 4. Scheduled work day (opener/closer/wfh) OR no schedule
        const isScheduledWork = WORK_TYPES.has(schedType);

        // Offset: approved banked OT used to shorten this day -> still credited as full standard day
        const offsetReq = offsetForEmp[date] || 0;
        if (offsetReq > 0 && (hasPunch || isScheduledWork)) {
          const useable = Math.min(offsetReq, Math.max(0, otBank));
          if (useable > 0) {
            otBank -= useable;
            offsetHoursUsed += useable;
            // Credit a full standard day (offset day always counts as STD hours)
            daysWorked += 1;
            regularHours += STD;
            lateMinutes += lateMin;
            if (holiday === 'regular') { holidayPay += STD * hourlyRate * P.multiplier_regular_holiday; }
            else if (holiday === 'special') { holidayPay += STD * hourlyRate * P.multiplier_special_holiday; }
            else { regularPay += STD * hourlyRate; }
            if (P.night_diff_enabled && nd > 0) { nightHours += nd; nightPay += nd * hourlyRate * (P.night_diff_rate || 0); }
            continue;
          }
        }

        if (hasPunch) {
          daysWorked += 1;
          const reg = Math.min(worked, STD);
          const extra = Math.max(0, worked - STD);
          const approvedOTHours = approvedOTForEmp[date] || 0;
          const ot = Math.min(extra >= 1 ? Math.floor(extra) : 0, approvedOTHours);
          regularHours += reg;
          overtimeHours += ot;
          lateMinutes += lateMin;
          // Undertime: short of the standard day (and no offset)
          if (P.deduct_undertime && reg < STD) undertimeMinutes += Math.round((STD - reg) * 60);
          if (holiday === 'regular') {
            holidayPay += reg * hourlyRate * P.multiplier_regular_holiday;
            overtimePay += ot * hourlyRate * P.ot_multiplier_regular_holiday;
          } else if (holiday === 'special') {
            holidayPay += reg * hourlyRate * P.multiplier_special_holiday;
            overtimePay += ot * hourlyRate * P.ot_multiplier_special_holiday;
          } else {
            regularPay += reg * hourlyRate;
            overtimePay += ot * hourlyRate * P.ot_multiplier_regular;
          }
          if (P.night_diff_enabled && nd > 0) { nightHours += nd; nightPay += nd * hourlyRate * (P.night_diff_rate || 0); }
        } else if (isScheduledWork) {
          daysAbsent += 1;
        }
      }

      const latesDeduction = (lateMinutes / 60) * hourlyRate;
      const undertimeDeduction = (undertimeMinutes / 60) * hourlyRate;
      // Absence deduction: one daily rate (monthly / working_days_divisor) per absent day.
      const absentDeduction = daysAbsent * dailyRate;
      const earnedPay = regularPay + overtimePay + holidayPay + leavePay + nightPay;
      const thirteenth = P.thirteenth_month_enabled ? (earnedPay / 12) : 0;
      const gross = money(earnedPay + allowanceTotal);

      const summary = {
        period_start,
        period_end,
        period_label: period_label || `${period_start} – ${period_end}`,
        employee_id: employee.id,
        airtable_record_id: employee.airtable_record_id,
        employee_code: getEmployeeCode(employee),
        employee_name: getEmployeeName(employee),
        basic_salary: money(monthlySalary),
        hourly_rate: money(hourlyRate),
        hours: money(regularHours),
        overtime_hours: money(overtimeHours),
        late_minutes: lateMinutes,
        undertime_minutes: undertimeMinutes,
        offset_hours: money(offsetHoursUsed),
        night_diff_hours: money(nightHours),
        night_diff_pay: money(nightPay),
        gross,
        lates_deduction: money(latesDeduction),
        undertime_deduction: money(undertimeDeduction),
        absent_deduction: money(absentDeduction),
        allowances: money(allowanceTotal),
        other_deductions: money(chargeTotal),
        thirteenth_month_accrual: money(thirteenth),
        days_worked: daysWorked,
        days_absent: daysAbsent,
        paid_leave_days: paidLeaveDays,
        regular_pay: money(regularPay),
        overtime_pay: money(overtimePay),
        holiday_pay: money(holidayPay),
        leave_pay: money(leavePay),
        computed_at: computedAt,
      };

      totalGross += gross;
      totalAllowances += money(allowanceTotal);
      totalDeductions += money(chargeTotal);
      totalAbsentDays += daysAbsent;

      const ex = existingByEmpId[employee.id];
      if (ex) recordsToUpdate.push({ id: ex.id, data: summary });
      else recordsToCreate.push(summary);

      processed += 1;
      // Update progress every 25 employees so the UI can show a live bar without spamming writes.
      if (processed % 25 === 0 || processed === totalEmployees) {
        await base44.asServiceRole.entities.ReconciliationRun.update(run.id, {
          processed, progress: totalEmployees ? Math.round((processed / totalEmployees) * 100) : 100,
        }).catch(() => {});
      }
    }

    try {
      await bulkCreateInChunks(base44.asServiceRole.entities.AttendancePaySummary, recordsToCreate);
      // Update existing summaries with a small delay to avoid rate limits, while reporting
      // progress back so the UI bar keeps moving through the save phase instead of looking frozen.
      let saved = 0;
      for (const r of recordsToUpdate) {
        await withRetry(() => base44.asServiceRole.entities.AttendancePaySummary.update(r.id, r.data));
        saved += 1;
        await wait(60);
        if (saved % 25 === 0) {
          await base44.asServiceRole.entities.ReconciliationRun.update(run.id, {
            processed: Math.min(totalEmployees, recordsToCreate.length + saved),
          }).catch(() => {});
        }
      }

      const finishedAt = new Date();
      await withRetry(() => base44.asServiceRole.entities.ReconciliationRun.update(run.id, {
        status: 'completed', progress: 100, processed: employees.length,
        employee_count: employees.length,
        total_gross: money(totalGross),
        total_allowances: money(totalAllowances),
        total_deductions: money(totalDeductions),
        total_absent_days: totalAbsentDays,
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt - runStartedAt,
      }));

    } catch (writeError) {
      const finishedAt = new Date();
      await base44.asServiceRole.entities.ReconciliationRun.update(run.id, {
        status: 'failed', error_message: writeError.message,
        finished_at: finishedAt.toISOString(), duration_ms: finishedAt - runStartedAt,
      }).catch(() => {});
      throw writeError;
    }
  } catch (error) {
    const finishedAt = new Date();
    await base44.asServiceRole.entities.ReconciliationRun.update(run.id, {
      status: 'failed', error_message: error.message,
      finished_at: finishedAt.toISOString(), duration_ms: finishedAt - runStartedAt,
    }).catch(() => {});
  }
}
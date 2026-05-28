import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function cleanText(value) {
  return String(value || '').trim();
}

function parseMoney(value) {
  const number = Number(cleanText(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function normalizeName(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getFields(employee) {
  return employee?.fields || {};
}

function getEmployeeName(employee) {
  const fields = getFields(employee);
  return cleanText(employee.full_name || fields['Full Name'] || [fields['First Name'], fields['Middle Name'], fields['Last Name']].filter(Boolean).join(' '));
}

function getEmployeeCode(employee) {
  const fields = getFields(employee);
  return cleanText(employee.employee_code || fields['Employee Code ID'] || fields['Employee Code']);
}

function getBiometricNumber(employee) {
  return cleanText(getFields(employee)['Biometrics Number']);
}

function isActiveEmployee(employee) {
  return cleanText(getFields(employee).Status).toLowerCase() === 'active';
}

function buildEmployeeKeys(employee) {
  return [
    employee.id,
    employee.airtable_record_id,
    getEmployeeCode(employee),
    getBiometricNumber(employee),
    normalizeName(getEmployeeName(employee)),
  ].filter(Boolean).map(key => String(key).trim());
}

function getSSSContribution(monthlySalary) {
  const table = [
    [4249.99, 180, 380], [4749.99, 202.5, 427.5], [5249.99, 225, 475], [5749.99, 247.5, 522.5],
    [6249.99, 270, 570], [6749.99, 292.5, 617.5], [7249.99, 315, 665], [7749.99, 337.5, 712.5],
    [8249.99, 360, 760], [8749.99, 382.5, 807.5], [9249.99, 405, 855], [9749.99, 427.5, 902.5],
    [10249.99, 450, 950], [10749.99, 472.5, 997.5], [11249.99, 495, 1045], [11749.99, 517.5, 1092.5],
    [12249.99, 540, 1140], [12749.99, 562.5, 1187.5], [13249.99, 585, 1235], [13749.99, 607.5, 1282.5],
    [14249.99, 630, 1330], [14749.99, 652.5, 1377.5], [15249.99, 675, 1425], [15749.99, 697.5, 1472.5],
    [16249.99, 720, 1520], [16749.99, 742.5, 1567.5], [17249.99, 765, 1615], [17749.99, 787.5, 1662.5],
    [18249.99, 810, 1710], [18749.99, 832.5, 1757.5], [19249.99, 855, 1805], [19749.99, 877.5, 1852.5],
    [20249.99, 900, 1900],
  ];
  if (monthlySalary < 4250) return { employee: 180, employer: 380 };
  for (const [cap, ee, er] of table) if (monthlySalary <= cap) return { employee: ee, employer: er };
  return { employee: 900, employer: 1900 };
}

function getPhilHealthContribution(monthlySalary) {
  const bracket = Math.min(Math.max(monthlySalary, 10000), 100000);
  const total = bracket * 0.05;
  return { employee: total / 2, employer: total / 2 };
}

function getPagIBIGContribution(monthlySalary) {
  if (monthlySalary <= 1500) return { employee: monthlySalary * 0.01, employer: monthlySalary * 0.02 };
  return { employee: Math.min(monthlySalary * 0.02, 100), employer: Math.min(monthlySalary * 0.02, 100) };
}

function computeWithholdingTax(annualTaxableIncome) {
  if (annualTaxableIncome <= 250000) return 0;
  if (annualTaxableIncome <= 400000) return (annualTaxableIncome - 250000) * 0.15;
  if (annualTaxableIncome <= 800000) return 22500 + (annualTaxableIncome - 400000) * 0.20;
  if (annualTaxableIncome <= 2000000) return 102500 + (annualTaxableIncome - 800000) * 0.25;
  if (annualTaxableIncome <= 8000000) return 402500 + (annualTaxableIncome - 2000000) * 0.30;
  return 2202500 + (annualTaxableIncome - 8000000) * 0.35;
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(operation, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      if (!message.includes('429') && !message.toLowerCase().includes('rate limit')) throw error;
      await wait(800 * (i + 1));
    }
  }
  throw lastError;
}

async function bulkCreateInChunks(entity, records, size = 25) {
  for (let i = 0; i < records.length; i += size) {
    await withRetry(() => entity.bulkCreate(records.slice(i, i + size)));
    await wait(300);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { payroll_run_id } = body;
    if (!payroll_run_id) return Response.json({ error: 'payroll_run_id required' }, { status: 400 });

    const runs = await withRetry(() => base44.asServiceRole.entities.PayrollRun.filter({ id: payroll_run_id }));
    if (!runs.length) return Response.json({ error: 'Payroll run not found' }, { status: 404 });
    const run = runs[0];

    const [allEmployees, hiddenUploads, allLogs, existingRecords] = await Promise.all([
      withRetry(() => base44.asServiceRole.entities.AirtableEmployeeRecord.list('-updated_date', 5000)),
      withRetry(() => base44.asServiceRole.entities.AttendanceUpload.list('-created_date', 200)),
      withRetry(() => base44.asServiceRole.entities.AttendanceLog.filter({ date: { $gte: run.period_start, $lte: run.period_end } }, 'date', 5000)),
      withRetry(() => base44.asServiceRole.entities.PayrollRecord.filter({ payroll_run_id }, '-created_date', 5000)),
    ]);

    const employees = allEmployees.filter(isActiveEmployee);
    const activeUploadIds = new Set(hiddenUploads.filter(upload => !['deleting', 'deleted'].includes(upload.status)).map(upload => upload.id));
    const logs = allLogs.filter(log => !log.upload_id || activeUploadIds.has(log.upload_id));
    const existingByEmployeeId = existingRecords.reduce((map, record) => ({ ...map, [record.employee_id]: record }), {});
    const recordsToCreate = [];
    const recordsToUpdate = [];
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const emp of employees) {
      const fields = getFields(emp);
      const employeeName = getEmployeeName(emp);
      const employeeCode = getEmployeeCode(emp);
      const monthlySalary = parseMoney(fields['Monthly Salary']);
      const hourlyRate = monthlySalary > 0 ? monthlySalary / 26 / 8 : 0;
      const allowances = parseMoney(fields.Allowances || fields['Allowance']);
      const employeeKeys = new Set(buildEmployeeKeys(emp));

      const periodLogs = logs.filter(log =>
        employeeKeys.has(cleanText(log.employee_id)) ||
        employeeKeys.has(cleanText(log.biometric_id)) ||
        employeeKeys.has(normalizeName(log.employee_name))
      );

      let daysWorked = 0;
      let daysAbsent = 0;
      let totalHours = 0;
      let regularHours = 0;
      let overtimeHours = 0;
      let totalLateMin = 0;
      let totalUndertimeMin = 0;

      for (const log of periodLogs) {
        const workedHours = Number(log.total_hours) || 0;
        if (log.time_in && log.time_out && workedHours > 0) {
          daysWorked += 1;
          totalHours += workedHours;
          regularHours += Math.min(workedHours, 8);
          overtimeHours += Math.max(workedHours - 8, 0);
        } else if (log.status === 'absent') {
          daysAbsent += 1;
        }
        totalLateMin += Number(log.late_minutes) || 0;
        totalUndertimeMin += Number(log.undertime_minutes) || 0;
      }

      const regularPay = regularHours * hourlyRate;
      const overtimePay = overtimeHours * hourlyRate * 1.25;
      const grossPay = regularPay + overtimePay + allowances;
      const sss = getSSSContribution(monthlySalary);
      const ph = getPhilHealthContribution(monthlySalary);
      const pi = getPagIBIGContribution(monthlySalary);
      const sssEE = sss.employee / 2;
      const sssER = sss.employer / 2;
      const phEE = ph.employee / 2;
      const phER = ph.employer / 2;
      const piEE = pi.employee / 2;
      const piER = pi.employer / 2;
      const annualTaxable = (monthlySalary * 12) - (sss.employee * 12) - (ph.employee * 12) - (pi.employee * 12);
      const periodTax = computeWithholdingTax(annualTaxable) / 24;
      const totalDeductionsForEmp = sssEE + phEE + piEE + periodTax;
      const netPay = grossPay - totalDeductionsForEmp;

      const payrollRecord = {
        payroll_run_id,
        employee_id: emp.id,
        airtable_record_id: emp.airtable_record_id,
        employee_code: employeeCode,
        employee_name: employeeName,
        basic_salary: money(monthlySalary),
        hourly_rate: money(hourlyRate),
        regular_pay: money(regularPay),
        days_worked: daysWorked,
        days_absent: daysAbsent,
        total_hours: money(totalHours),
        late_minutes: totalLateMin,
        undertime_minutes: totalUndertimeMin,
        overtime_hours: money(overtimeHours),
        overtime_pay: money(overtimePay),
        allowances: money(allowances),
        gross_pay: money(grossPay),
        sss_employee: money(sssEE),
        sss_employer: money(sssER),
        philhealth_employee: money(phEE),
        philhealth_employer: money(phER),
        pagibig_employee: money(piEE),
        pagibig_employer: money(piER),
        withholding_tax: money(periodTax),
        late_deduction: 0,
        absent_deduction: 0,
        other_deductions: 0,
        total_deductions: money(totalDeductionsForEmp),
        net_pay: money(netPay),
        status: 'computed',
      };

      const existingRecord = existingByEmployeeId[emp.id];
      if (existingRecord) recordsToUpdate.push({ id: existingRecord.id, data: payrollRecord });
      else recordsToCreate.push(payrollRecord);

      totalGross += grossPay;
      totalDeductions += totalDeductionsForEmp;
      totalNet += netPay;
    }

    await bulkCreateInChunks(base44.asServiceRole.entities.PayrollRecord, recordsToCreate);
    for (const record of recordsToUpdate) {
      await withRetry(() => base44.asServiceRole.entities.PayrollRecord.update(record.id, record.data));
      await wait(150);
    }

    await withRetry(() => base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
      total_gross: money(totalGross),
      total_deductions: money(totalDeductions),
      total_net: money(totalNet),
      employee_count: employees.length,
      status: 'processing',
    }));

    return Response.json({
      success: true,
      employee_count: employees.length,
      total_gross: money(totalGross),
      total_net: money(totalNet),
      message: `Payroll computed from Airtable employees for ${employees.length} employees.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
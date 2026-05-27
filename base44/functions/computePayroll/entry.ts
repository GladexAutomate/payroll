import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Philippine SSS Contribution Table 2024
function getSSSContribution(monthlySalary) {
  const table = [
    [4249.99, 180, 380],
    [4749.99, 202.5, 427.5],
    [5249.99, 225, 475],
    [5749.99, 247.5, 522.5],
    [6249.99, 270, 570],
    [6749.99, 292.5, 617.5],
    [7249.99, 315, 665],
    [7749.99, 337.5, 712.5],
    [8249.99, 360, 760],
    [8749.99, 382.5, 807.5],
    [9249.99, 405, 855],
    [9749.99, 427.5, 902.5],
    [10249.99, 450, 950],
    [10749.99, 472.5, 997.5],
    [11249.99, 495, 1045],
    [11749.99, 517.5, 1092.5],
    [12249.99, 540, 1140],
    [12749.99, 562.5, 1187.5],
    [13249.99, 585, 1235],
    [13749.99, 607.5, 1282.5],
    [14249.99, 630, 1330],
    [14749.99, 652.5, 1377.5],
    [15249.99, 675, 1425],
    [15749.99, 697.5, 1472.5],
    [16249.99, 720, 1520],
    [16749.99, 742.5, 1567.5],
    [17249.99, 765, 1615],
    [17749.99, 787.5, 1662.5],
    [18249.99, 810, 1710],
    [18749.99, 832.5, 1757.5],
    [19249.99, 855, 1805],
    [19749.99, 877.5, 1852.5],
    [20249.99, 900, 1900],
  ];

  if (monthlySalary < 4250) return { employee: 180, employer: 380 };
  for (const [cap, ee, er] of table) {
    if (monthlySalary <= cap) return { employee: ee, employer: er };
  }
  return { employee: 900, employer: 1900 }; // max
}

// PhilHealth 2024: 5% of basic salary, split 50/50, max salary bracket 100k
function getPhilHealthContribution(monthlySalary) {
  const rate = 0.05;
  const minSalary = 10000;
  const maxSalary = 100000;
  const bracket = Math.min(Math.max(monthlySalary, minSalary), maxSalary);
  const total = bracket * rate;
  return { employee: total / 2, employer: total / 2 };
}

// Pag-IBIG 2024
function getPagIBIGContribution(monthlySalary) {
  if (monthlySalary <= 1500) {
    return { employee: monthlySalary * 0.01, employer: monthlySalary * 0.02 };
  }
  return { employee: Math.min(monthlySalary * 0.02, 100), employer: Math.min(monthlySalary * 0.02, 100) };
}

// BIR TRAIN Law 2024 (Annual tax table)
function computeWithholdingTax(annualTaxableIncome) {
  if (annualTaxableIncome <= 250000) return 0;
  if (annualTaxableIncome <= 400000) return (annualTaxableIncome - 250000) * 0.15;
  if (annualTaxableIncome <= 800000) return 22500 + (annualTaxableIncome - 400000) * 0.20;
  if (annualTaxableIncome <= 2000000) return 102500 + (annualTaxableIncome - 800000) * 0.25;
  if (annualTaxableIncome <= 8000000) return 402500 + (annualTaxableIncome - 2000000) * 0.30;
  return 2202500 + (annualTaxableIncome - 8000000) * 0.35;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { payroll_run_id } = body;
    if (!payroll_run_id) return Response.json({ error: 'payroll_run_id required' }, { status: 400 });

    const runs = await base44.asServiceRole.entities.PayrollRun.filter({ id: payroll_run_id });
    if (!runs.length) return Response.json({ error: 'Payroll run not found' }, { status: 404 });
    const run = runs[0];

    const employees = await base44.asServiceRole.entities.Employee.filter({ status: 'active' });
    const holidays = await base44.asServiceRole.entities.HolidayCalendar.filter({});

    const holidayDates = new Set(holidays.map(h => h.date));
    const regularHolidays = new Set(holidays.filter(h => h.type === 'regular').map(h => h.date));

    let totalGross = 0, totalDeductions = 0, totalNet = 0;

    for (const emp of employees) {
      const basicSalary = emp.basic_salary || 0;
      const isMonthly = emp.pay_frequency === 'monthly';
      const periodSalary = isMonthly ? basicSalary : basicSalary / 2;

      // Get attendance logs for this period
      const logs = await base44.asServiceRole.entities.AttendanceLog.filter({
        employee_id: emp.id
      });
      const periodLogs = logs.filter(l => l.date >= run.period_start && l.date <= run.period_end);

      // Get approved overtime
      const otRequests = await base44.asServiceRole.entities.OvertimeRequest.filter({
        employee_id: emp.id,
        status: 'approved'
      });
      const periodOT = otRequests.filter(o => o.date >= run.period_start && o.date <= run.period_end);
      const totalOTHours = periodOT.reduce((s, o) => s + (o.approved_hours || 0), 0);

      // Compute attendance metrics
      let daysWorked = 0, daysAbsent = 0, totalLateMin = 0, totalUndertimeMin = 0;
      for (const log of periodLogs) {
        if (log.status === 'present' || log.status === 'half_day') {
          daysWorked += log.status === 'half_day' ? 0.5 : 1;
          totalLateMin += log.late_minutes || 0;
          totalUndertimeMin += log.undertime_minutes || 0;
        } else if (log.status === 'absent') {
          daysAbsent++;
        }
      }

      // Daily rate
      const dailyRate = basicSalary / 26; // 26 working days/month standard PH
      const hourlyRate = dailyRate / 8;
      const minuteRate = hourlyRate / 60;

      // Overtime pay (125% on regular day)
      const overtimePay = totalOTHours * hourlyRate * 1.25;

      // Deductions for late/undertime
      const lateDeduction = totalLateMin * minuteRate;
      const absentDeduction = daysAbsent * dailyRate;

      // Gross pay
      const grossPay = periodSalary + overtimePay + (emp.allowances || 0) - lateDeduction - absentDeduction;

      // Statutory contributions (based on monthly salary)
      const sss = getSSSContribution(basicSalary);
      const ph = getPhilHealthContribution(basicSalary);
      const pi = getPagIBIGContribution(basicSalary);

      // For semi-monthly, split contributions in half
      const sssEE = isMonthly ? sss.employee : sss.employee / 2;
      const sssER = isMonthly ? sss.employer : sss.employer / 2;
      const phEE = isMonthly ? ph.employee : ph.employee / 2;
      const phER = isMonthly ? ph.employer : ph.employer / 2;
      const piEE = isMonthly ? pi.employee : pi.employee / 2;
      const piER = isMonthly ? pi.employer : pi.employer / 2;

      // Withholding tax (annual computation)
      const annualGross = basicSalary * 12;
      const annualSSS = sss.employee * 12;
      const annualPH = ph.employee * 12;
      const annualPI = piEE * 12;
      const annualTaxable = annualGross - annualSSS - annualPH - annualPI;
      const annualTax = computeWithholdingTax(annualTaxable);
      const periodTax = isMonthly ? annualTax / 12 : annualTax / 24;

      const totalDeductionsForEmp = sssEE + phEE + piEE + periodTax + lateDeduction + absentDeduction;
      const netPay = grossPay - sssEE - phEE - piEE - periodTax;

      // Delete existing record for this run+employee if any
      const existing = await base44.asServiceRole.entities.PayrollRecord.filter({
        payroll_run_id,
        employee_id: emp.id
      });
      for (const ex of existing) {
        await base44.asServiceRole.entities.PayrollRecord.delete(ex.id);
      }

      await base44.asServiceRole.entities.PayrollRecord.create({
        payroll_run_id,
        employee_id: emp.id,
        basic_salary: basicSalary,
        days_worked: daysWorked,
        days_absent: daysAbsent,
        late_minutes: totalLateMin,
        undertime_minutes: totalUndertimeMin,
        overtime_hours: totalOTHours,
        overtime_pay: Math.round(overtimePay * 100) / 100,
        allowances: emp.allowances || 0,
        gross_pay: Math.round(grossPay * 100) / 100,
        sss_employee: Math.round(sssEE * 100) / 100,
        sss_employer: Math.round(sssER * 100) / 100,
        philhealth_employee: Math.round(phEE * 100) / 100,
        philhealth_employer: Math.round(phER * 100) / 100,
        pagibig_employee: Math.round(piEE * 100) / 100,
        pagibig_employer: Math.round(piER * 100) / 100,
        withholding_tax: Math.round(periodTax * 100) / 100,
        late_deduction: Math.round(lateDeduction * 100) / 100,
        absent_deduction: Math.round(absentDeduction * 100) / 100,
        other_deductions: 0,
        total_deductions: Math.round(totalDeductionsForEmp * 100) / 100,
        net_pay: Math.round(netPay * 100) / 100,
        status: 'computed'
      });

      totalGross += grossPay;
      totalDeductions += totalDeductionsForEmp;
      totalNet += netPay;
    }

    // Update run totals
    await base44.asServiceRole.entities.PayrollRun.update(payroll_run_id, {
      total_gross: Math.round(totalGross * 100) / 100,
      total_deductions: Math.round(totalDeductions * 100) / 100,
      total_net: Math.round(totalNet * 100) / 100,
      employee_count: employees.length,
      status: 'processing'
    });

    return Response.json({
      success: true,
      employee_count: employees.length,
      total_gross: totalGross,
      total_net: totalNet,
      message: `Payroll computed for ${employees.length} employees.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
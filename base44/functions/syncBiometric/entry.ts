import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ZKTeco device connection via HTTP/CGI interface (AIFACE11 supports HTTP API)
// The AIFACE11 AI Face device uses ZKTeco's ADMS/PUSH protocol and HTTP CGI interface

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const deviceIp = body.device_ip || '112.209.71.138';
    const devicePort = body.device_port || 80;
    const username = body.username || 'admin';
    const password = body.password || '12345';

    // Log sync start
    const syncStart = new Date().toISOString();
    let recordsFetched = 0;
    let recordsSaved = 0;
    let errorMsg = null;

    // ZKTeco AIFACE11 HTTP CGI API - get attendance records
    // Standard ZKTeco HTTP API endpoint for attendance logs
    const authHeader = 'Basic ' + btoa(`${username}:${password}`);
    
    let attendanceRecords = [];
    
    try {
      // Try ZKTeco HTTP CGI interface
      const response = await fetch(
        `http://${deviceIp}:${devicePort}/iclock/cdata?ACTION=att&StartStamp=2000-01-01T00:00:00&EndStamp=${new Date().toISOString().slice(0,19)}`,
        {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'text/plain'
          },
          signal: AbortSignal.timeout(15000)
        }
      );

      if (response.ok) {
        const text = await response.text();
        // Parse ZKTeco text format: PIN\tDateTime\tVerifyType\tStatus
        const lines = text.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const parts = line.trim().split('\t');
          if (parts.length >= 2) {
            const pin = parts[0];
            const timestamp = parts[1];
            if (pin && timestamp) {
              attendanceRecords.push({ pin, timestamp, verify_type: parts[2] || '0', status: parts[3] || '0' });
            }
          }
        }
        recordsFetched = attendanceRecords.length;
      } else {
        errorMsg = `Device responded with HTTP ${response.status}`;
      }
    } catch (deviceError) {
      errorMsg = `Cannot reach device: ${deviceError.message}. The device at ${deviceIp} may require VPN/direct network access or different credentials. Records can be imported manually.`;
    }

    // Group punches by employee and date
    const grouped = {};
    for (const record of attendanceRecords) {
      const dt = new Date(record.timestamp);
      const dateKey = dt.toISOString().slice(0, 10);
      const key = `${record.pin}_${dateKey}`;
      if (!grouped[key]) {
        grouped[key] = { pin: record.pin, date: dateKey, punches: [] };
      }
      grouped[key].punches.push(record.timestamp);
    }

    // Find all employees to map biometric_id → employee_id
    const employees = await base44.asServiceRole.entities.Employee.filter({ status: 'active' });
    const bioMap = {};
    for (const emp of employees) {
      if (emp.biometric_id) bioMap[emp.biometric_id] = emp.id;
    }

    // Save attendance logs
    for (const [, group] of Object.entries(grouped)) {
      const empId = bioMap[group.pin];
      const sortedPunches = group.punches.sort();
      const timeIn = sortedPunches[0];
      const timeOut = sortedPunches[sortedPunches.length - 1];
      
      // Compute total hours
      const inMs = new Date(timeIn).getTime();
      const outMs = new Date(timeOut).getTime();
      const totalHours = sortedPunches.length > 1 ? Math.round((outMs - inMs) / 36000) / 100 : 0;

      // Check if log already exists for this employee+date
      const existing = await base44.asServiceRole.entities.AttendanceLog.filter({
        employee_id: empId || group.pin,
        date: group.date
      });

      if (existing.length === 0) {
        await base44.asServiceRole.entities.AttendanceLog.create({
          employee_id: empId || group.pin,
          biometric_id: group.pin,
          date: group.date,
          time_in: timeIn,
          time_out: sortedPunches.length > 1 ? timeOut : null,
          raw_punches: sortedPunches,
          total_hours: totalHours,
          status: 'present'
        });
        recordsSaved++;
      }
    }

    // Save sync log
    await base44.asServiceRole.entities.BiometricSyncLog.create({
      sync_time: syncStart,
      status: errorMsg && recordsFetched === 0 ? 'failed' : recordsFetched > 0 ? 'success' : 'partial',
      records_fetched: recordsFetched,
      records_saved: recordsSaved,
      device_ip: deviceIp,
      error_message: errorMsg,
      triggered_by: user.email
    });

    return Response.json({
      success: true,
      records_fetched: recordsFetched,
      records_saved: recordsSaved,
      error: errorMsg,
      message: errorMsg
        ? `Sync attempted. ${errorMsg}`
        : `Successfully synced ${recordsSaved} new attendance records from device.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
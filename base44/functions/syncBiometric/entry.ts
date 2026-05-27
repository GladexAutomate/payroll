import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ZKTeco ADMS Push Protocol receiver
// The AIFACE11 device pushes attendance records TO this endpoint.
// Configure on device: Menu → Comm → Cloud Server Settings → Server Address = this function's URL

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Handle device heartbeat / info requests (GET)
  if (req.method === 'GET') {
    // ZKTeco devices send GET to check server is alive, respond with current server time
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').slice(0, 19);
    return new Response(`GET PUSH RESULT OK\nServerVersion:2.4.1 88\nServerTime:${timeStr}`, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const body = await req.text();

    // Log the raw push for debugging
    console.log('ZKTeco push received:', req.method, contentType);
    console.log('Body:', body.slice(0, 500));

    let attendanceRecords = [];
    const deviceIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Parse ZKTeco ADMS push format
    // The device sends: PIN\tDateTime\tVerifyMode\tInOutStatus\tWorkCode
    // or JSON depending on firmware version
    if (contentType.includes('application/json')) {
      const json = JSON.parse(body);
      // Some firmware sends { records: [...] }
      const raw = json.records || json.Record || [json];
      for (const r of raw) {
        if (r.PIN && r.DateTime) {
          attendanceRecords.push({ pin: String(r.PIN), timestamp: r.DateTime });
        }
      }
    } else {
      // Text format: each line is one punch record
      const lines = body.split('\n').filter(l => l.trim());
      for (const line of lines) {
        // Skip header/meta lines
        if (line.startsWith('GET') || line.startsWith('POST') || line.startsWith('Content')) continue;
        const parts = line.trim().split('\t');
        if (parts.length >= 2) {
          const pin = parts[0]?.trim();
          const timestamp = parts[1]?.trim();
          if (pin && timestamp && pin !== 'PIN') {
            attendanceRecords.push({ pin, timestamp });
          }
        }
      }
    }

    console.log(`Parsed ${attendanceRecords.length} records`);

    if (attendanceRecords.length === 0) {
      // Device may be sending a keepalive — log it and respond OK
      await base44.asServiceRole.entities.BiometricSyncLog.create({
        sync_time: new Date().toISOString(),
        status: 'partial',
        records_fetched: 0,
        records_saved: 0,
        device_ip: deviceIp,
        error_message: 'Keepalive or empty push received',
        triggered_by: 'device_push'
      });
      return new Response('OK', { headers: { 'Content-Type': 'text/plain' } });
    }

    // Group punches by employee+date
    const grouped = {};
    for (const record of attendanceRecords) {
      const dt = new Date(record.timestamp);
      if (isNaN(dt.getTime())) continue;
      const dateKey = dt.toISOString().slice(0, 10);
      const key = `${record.pin}_${dateKey}`;
      if (!grouped[key]) {
        grouped[key] = { pin: record.pin, date: dateKey, punches: [] };
      }
      grouped[key].punches.push(record.timestamp);
    }

    // Map biometric IDs to employee IDs
    const employees = await base44.asServiceRole.entities.Employee.filter({ status: 'active' });
    const bioMap = {};
    for (const emp of employees) {
      if (emp.biometric_id) bioMap[emp.biometric_id] = emp.id;
      if (emp.employee_id) bioMap[emp.employee_id] = emp.id;
    }

    let recordsSaved = 0;
    for (const [, group] of Object.entries(grouped)) {
      const empId = bioMap[group.pin];
      const sortedPunches = group.punches.sort();
      const timeIn = sortedPunches[0];
      const timeOut = sortedPunches.length > 1 ? sortedPunches[sortedPunches.length - 1] : null;
      const inMs = new Date(timeIn).getTime();
      const outMs = timeOut ? new Date(timeOut).getTime() : inMs;
      const totalHours = timeOut ? Math.round((outMs - inMs) / 36000) / 100 : 0;

      // Upsert: update if exists, create if not
      const existing = await base44.asServiceRole.entities.AttendanceLog.filter({
        employee_id: empId || group.pin,
        date: group.date
      });

      if (existing.length > 0) {
        // Update with latest punch data
        const allPunches = [...new Set([...(existing[0].raw_punches || []), ...sortedPunches])].sort();
        const newTimeOut = allPunches.length > 1 ? allPunches[allPunches.length - 1] : null;
        const newTotal = newTimeOut ? Math.round((new Date(newTimeOut) - new Date(allPunches[0])) / 36000) / 100 : 0;
        await base44.asServiceRole.entities.AttendanceLog.update(existing[0].id, {
          time_out: newTimeOut,
          raw_punches: allPunches,
          total_hours: newTotal
        });
      } else {
        await base44.asServiceRole.entities.AttendanceLog.create({
          employee_id: empId || group.pin,
          biometric_id: group.pin,
          date: group.date,
          time_in: timeIn,
          time_out: timeOut,
          raw_punches: sortedPunches,
          total_hours: totalHours,
          status: 'present'
        });
        recordsSaved++;
      }
    }

    // Save sync log
    await base44.asServiceRole.entities.BiometricSyncLog.create({
      sync_time: new Date().toISOString(),
      status: 'success',
      records_fetched: attendanceRecords.length,
      records_saved: recordsSaved,
      device_ip: deviceIp,
      triggered_by: 'device_push'
    });

    // ZKTeco expects plain "OK" response
    return new Response('OK', { headers: { 'Content-Type': 'text/plain' } });

  } catch (error) {
    console.error('Push handler error:', error.message);
    await base44.asServiceRole.entities.BiometricSyncLog.create({
      sync_time: new Date().toISOString(),
      status: 'failed',
      records_fetched: 0,
      records_saved: 0,
      error_message: error.message,
      triggered_by: 'device_push'
    });
    return new Response('ERROR', { status: 500, headers: { 'Content-Type': 'text/plain' } });
  }
});
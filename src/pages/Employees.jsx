import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EmployeeForm from '@/components/employees/EmployeeForm';
import AirtableMatchCell from '@/components/employees/AirtableMatchCell';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [airtableRecords, setAirtableRecords] = useState([]);
  const [syncingMatches, setSyncingMatches] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!loading && employees.length && airtableRecords.length && !syncingMatches) {
      const hasPendingAutoMatch = employees.some(employee => {
        if (matchMap[employee.id] || !employee.employee_id) return false;
        return airtableRecords.some(record => airtableMatchName(record) === employeeMatchName(employee) || airtableSmartMatchName(record) === employeeSmartMatchName(employee) || firstLastTokensMatch(employeeFullName(employee), airtableFullName(record)));
      });
      if (hasPendingAutoMatch) autoMatchEmployees();
    }
  }, [loading, employees.length, airtableRecords.length, matches.length]);

  const loadData = async () => {
    setLoading(true);
    const [emps, depts, savedMatches, airtableRes] = await Promise.all([
      base44.entities.Employee.list('-created_date', 200),
      base44.entities.Department.list(),
      base44.entities.EmployeeAirtableMatch.list('-updated_date', 1000),
      base44.functions.invoke('airtableEmployees', { action: 'matchCandidates' })
    ]);
    setEmployees(emps);
    setDepartments(depts);
    setMatches(savedMatches);
    setAirtableRecords(airtableRes.data?.records || []);
    setLoading(false);
  };

  const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ');
  const employeeFullName = (employee) => [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim();
  const airtableFullName = (record) => {
    const fields = record.fields || {};
    return record.full_name || fields['Full Name'] || [fields['First Name'], fields['Last Name']].filter(Boolean).join(' ').trim();
  };
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
  const employeeMatchName = (employee) => {
    const first = String(employee.first_name || '').trim();
    const last = String(employee.last_name || '').trim();
    return normalizeName(last ? `${first} ${last}` : first);
  };
  const airtableMatchName = (record) => {
    const fields = record.fields || {};
    return normalizeName([fields['First Name'], fields['Last Name']].filter(Boolean).join(' '));
  };
  const employeeSmartMatchName = (employee) => smartNameKey(employeeFullName(employee));
  const airtableSmartMatchName = (record) => smartNameKey(airtableFullName(record));
  const matchMap = matches.reduce((map, match) => ({ ...map, [match.employee_record_id]: match }), {});
  const airtableRecordMap = airtableRecords.reduce((map, record) => ({ ...map, [record.airtable_record_id || record.id]: record }), {});
  const getEmployeeStatus = (employee) => {
    const match = matchMap[employee.id];
    const airtableRecord = match ? airtableRecordMap[match.airtable_record_id] : null;
    return airtableRecord?.fields?.Status ? String(airtableRecord.fields.Status).toLowerCase() : 'unmatched';
  };

  const filtered = employees.filter(e => {
    const matchSearch = !search || 
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
      e.position?.toLowerCase().includes(search.toLowerCase());
    const employeeStatus = getEmployeeStatus(e);
    const matchStatus = filterStatus === 'all' || employeeStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSave = async (data) => {
    if (editingEmployee) {
      await base44.entities.Employee.update(editingEmployee.id, data);
    } else {
      await base44.entities.Employee.create(data);
    }
    setShowForm(false);
    setEditingEmployee(null);
    loadData();
  };

  const connectMatch = async (employee, airtableRecord, matchStatus = 'manual') => {
    const res = await base44.functions.invoke('airtableEmployees', {
      action: 'syncBiometricsMatch',
      employeeRecordId: employee.id,
      employeeNumber: employee.employee_id,
      employeeName: employeeFullName(employee),
      airtableRecordId: airtableRecord.airtable_record_id || airtableRecord.id,
      matchStatus,
    });
    setMatches(prev => [...prev.filter(match => match.employee_record_id !== employee.id), res.data.match]);
  };

  const autoMatchEmployees = async () => {
    setSyncingMatches(true);
    const existingEmployeeIds = new Set(matches.map(match => match.employee_record_id));
    for (const employee of employees) {
      if (existingEmployeeIds.has(employee.id) || !employee.employee_id) continue;
      const localName = employeeMatchName(employee);
      const smartLocalName = employeeSmartMatchName(employee);
      const matchedRecord = airtableRecords.find(record => airtableMatchName(record) === localName || airtableSmartMatchName(record) === smartLocalName || firstLastTokensMatch(employeeFullName(employee), airtableFullName(record)));
      if (matchedRecord) await connectMatch(employee, matchedRecord, 'matched');
    }
    setSyncingMatches(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Employee.update(id, { status: 'terminated' });
    loadData();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="unmatched">No Match</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoMatchEmployees} disabled={loading || syncingMatches} className="shrink-0">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${syncingMatches ? 'animate-spin' : ''}`} /> Match Airtable
          </Button>
          <Button onClick={() => { setEditingEmployee(null); setShowForm(true); }} className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Airtable Match</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee No.</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors align-top">
                  <td className="py-3.5 px-4">
                    <AirtableMatchCell
                      employee={emp}
                      match={matchMap[emp.id]}
                      airtableRecords={airtableRecords}
                      onConnect={connectMatch}
                    />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs text-primary font-semibold">
                          {emp.first_name?.[0]}{emp.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {getEmployeeStatus(emp) === 'unmatched' ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-700">No Match</span>
                    ) : (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getEmployeeStatus(emp) === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {getEmployeeStatus(emp) === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-muted-foreground">{emp.employee_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            Showing {filtered.length} of {employees.length} employees
          </div>
        )}
      </div>

      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          departments={departments}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingEmployee(null); }}
        />
      )}
    </div>
  );
}
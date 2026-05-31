import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getAirtableEmployeeName } from '@/utils/airtableEmployee';

const FIELDS = [
  ['sss_enabled', 'SSS'],
  ['philhealth_enabled', 'PhilHealth'],
  ['pagibig_enabled', 'Pag-IBIG'],
];

export default function GovernmentSettings({ employees }) {
  const [settings, setSettings] = useState({}); // employee_id -> record
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const rows = await base44.entities.EmployeeGovernmentSetting.list('-updated_date', 5000);
    setSettings(rows.reduce((m, r) => ({ ...m, [r.employee_id]: r }), {}));
    setLoading(false);
  };

  const getVal = (empId, key) => {
    const rec = settings[empId];
    return rec ? rec[key] !== false : true; // default ON
  };

  const toggle = async (emp, key) => {
    const empId = emp.id;
    const current = settings[empId];
    const next = {
      sss_enabled: getVal(empId, 'sss_enabled'),
      philhealth_enabled: getVal(empId, 'philhealth_enabled'),
      pagibig_enabled: getVal(empId, 'pagibig_enabled'),
      [key]: !getVal(empId, key),
    };
    // optimistic update
    setSettings(p => ({ ...p, [empId]: { ...(current || {}), ...next, employee_id: empId } }));
    if (current?.id) {
      await base44.entities.EmployeeGovernmentSetting.update(current.id, next);
    } else {
      const created = await base44.entities.EmployeeGovernmentSetting.create({
        employee_id: empId,
        employee_name: getAirtableEmployeeName(emp),
        ...next,
      });
      setSettings(p => ({ ...p, [empId]: created }));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e => getAirtableEmployeeName(e).toLowerCase().includes(q));
  }, [employees, search]);

  return (
    <div className="space-y-3">
      <Input placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                {FIELDS.map(([, label]) => (
                  <th key={label} className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => <tr key={i} className="border-b border-border/50">{[...Array(4)].map((_, j) => <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No employees.</td></tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium">{getAirtableEmployeeName(emp)}</td>
                  {FIELDS.map(([key]) => (
                    <td key={key} className="py-3 px-4 text-center">
                      <Switch checked={getVal(emp.id, key)} onCheckedChange={() => toggle(emp, key)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Turn a contribution off to exclude that employee from the mandatory government deduction in payroll.</p>
    </div>
  );
}
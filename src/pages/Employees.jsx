import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';
import EmployeeForm from '@/components/employees/EmployeeForm';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [emps, depts] = await Promise.all([
      base44.entities.Employee.list('-created_date', 200),
      base44.entities.Department.list()
    ]);
    setEmployees(emps);
    setDepartments(depts);
    setLoading(false);
  };

  const deptMap = departments.reduce((m, d) => ({ ...m, [d.id]: d.name }), {});

  const filtered = employees.filter(e => {
    const matchSearch = !search || 
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
      e.position?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
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
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <Button onClick={() => { setEditingEmployee(null); setShowForm(true); }} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> Add Employee
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee No.</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Department</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Position</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Basic Salary</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="py-3.5 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
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
                  <td className="py-3.5 px-4 font-medium text-muted-foreground">{emp.employee_id || '—'}</td>
                  <td className="py-3.5 px-4 text-muted-foreground">{deptMap[emp.department_id] || '—'}</td>
                  <td className="py-3.5 px-4 text-muted-foreground">{emp.position || '—'}</td>
                  <td className="py-3.5 px-4 font-medium">₱{(emp.basic_salary || 0).toLocaleString('en-PH')}</td>
                  <td className="py-3.5 px-4"><StatusBadge status={emp.status} /></td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditingEmployee(emp); setShowForm(true); }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Terminate Employee</AlertDialogTitle>
                            <AlertDialogDescription>
                              Mark {emp.first_name} {emp.last_name} as terminated? This won't delete their records.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() => handleDelete(emp.id)}
                            >
                              Terminate
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
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
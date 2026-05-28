import { useMemo, useState } from 'react';
import { X, Users, GripVertical, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const employeeName = (employee) => {
  const fullName = employee.full_name || [employee.first_name, employee.last_name].filter(Boolean).join(' ');
  return fullName || employee.employee_code || employee.employee_id || employee.email || 'Unnamed employee';
};

const categoryLabels = {
  company: 'Company',
  branch: 'Branch',
  department: 'Department',
  department_role: 'Department Role',
  team: 'Team',
};

export default function EmployeeListModal({ employees, label = 'employees', title, open, onOpen, onClose, categories = {}, onUpdated }) {
  const count = employees.length;
  const [category, setCategory] = useState('company');
  const [draggingEmployee, setDraggingEmployee] = useState(null);
  const [saving, setSaving] = useState(false);

  const categoryItems = useMemo(() => categories[category] || [], [categories, category]);

  const moveEmployee = async (target) => {
    if (!draggingEmployee?.airtable_record_id || !target?.name) return;
    setSaving(true);
    await base44.functions.invoke('airtableEmployees', {
      action: 'reassignEmployeeCategory',
      recordId: draggingEmployee.airtable_record_id,
      category,
      target,
    });
    setDraggingEmployee(null);
    setSaving(false);
    onUpdated?.();
  };

  return (
    <>
      <button type="button" onClick={onOpen} className="text-xs text-primary hover:underline font-medium text-left">
        {count} {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-5xl max-h-[86vh] flex flex-col">
            <div className="p-5 border-b border-border flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Drag employee names to a category item to update Airtable.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid md:grid-cols-[1fr_320px] min-h-0">
              <div className="p-5 overflow-y-auto space-y-2 border-r border-border">
                {count === 0 ? (
                  <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">No employees found.</div>
                ) : employees.map((employee, index) => (
                  <div
                    key={employee.id || employee.airtable_record_id || index}
                    draggable
                    onDragStart={() => setDraggingEmployee(employee)}
                    className="rounded-xl border border-border p-3 cursor-grab active:cursor-grabbing bg-background hover:border-primary/50"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{employeeName(employee)}</p>
                        {(employee.employee_code || employee.employee_id || employee.email) && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{employee.employee_code || employee.employee_id || employee.email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-5 space-y-3 overflow-y-auto bg-muted/20">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Move to category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {Object.entries(categoryLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </div>

                {saving && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Updating Airtable...</div>}

                <div className="space-y-2">
                  {categoryItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground text-center">No items in this category.</div>
                  ) : categoryItems.map(item => (
                    <div
                      key={`${category}-${item.id || item.name}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => moveEmployee(item)}
                      className="rounded-xl border border-border bg-card p-3 text-sm hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">Drop employee here</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
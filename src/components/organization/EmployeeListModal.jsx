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

const itemKey = (item) => [item.company_name, item.branch_name, item.department_name, item.name].filter(Boolean).join(' / ').toLowerCase();
const dedupeItems = (items = []) => Array.from(new Map(items.map(item => [item.id || itemKey(item), item])).values());

export default function EmployeeListModal({ employees, label = 'employees', title, open, onOpen, onClose, categories = {}, onUpdated }) {
  const count = employees.length;
  const [category, setCategory] = useState('company');
  const [draggingEmployee, setDraggingEmployee] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [movedEmployeeIds, setMovedEmployeeIds] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [poppedTarget, setPoppedTarget] = useState(null);

  const categoryItems = useMemo(() => dedupeItems(categories[category] || []), [categories, category]);
  const displayEmployees = useMemo(
    () => employees.filter(employee => !movedEmployeeIds.includes(employee.airtable_record_id || employee.id)),
    [employees, movedEmployeeIds]
  );

  const moveEmployee = async (target) => {
    if (!draggingEmployee?.airtable_record_id || !target?.name) return;
    const targetKey = `${category}-${target.id || itemKey(target)}`;
    setPoppedTarget(targetKey);
    setTimeout(() => setPoppedTarget(null), 450);
    setSaving(true);
    await base44.functions.invoke('airtableEmployees', {
      action: 'reassignEmployeeCategory',
      recordId: draggingEmployee.airtable_record_id,
      category,
      target,
    });
    setMovedEmployeeIds(prev => [...prev, draggingEmployee.airtable_record_id || draggingEmployee.id]);
    setPendingRefresh(true);
    setDraggingEmployee(null);
    setDraggingId(null);
    setSaving(false);
  };

  const handleClose = () => {
    if (pendingRefresh) onUpdated?.();
    onClose();
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
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid md:grid-cols-[1fr_320px] min-h-0">
              <div className="p-5 overflow-y-auto space-y-2 border-r border-border">
                {displayEmployees.length === 0 ? (
                  <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">No employees found.</div>
                ) : displayEmployees.map((employee, index) => (
                  <div
                    key={employee.id || employee.airtable_record_id || index}
                    draggable
                    onDragStart={(event) => {
                      setDraggingEmployee(employee);
                      setDraggingId(employee.airtable_record_id || employee.id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setDragImage(event.currentTarget, 24, 24);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`rounded-xl border p-3 cursor-grab active:cursor-grabbing bg-background transition-all duration-200 hover:border-primary/50 ${draggingId === (employee.airtable_record_id || employee.id) ? 'border-primary bg-primary/10 shadow-lg scale-[1.01]' : 'border-border'}`}
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
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {Object.entries(categoryLabels).map(([value, text]) => (
                      <label key={value} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${category === value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background'}`}>
                        <input type="checkbox" checked={category === value} onChange={() => setCategory(value)} className="rounded border-input" />
                        <span>{text}</span>
                      </label>
                    ))}
                  </div>
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
                      className={`rounded-xl border bg-card p-3 text-sm hover:border-primary hover:bg-primary/5 transition-all duration-200 ${poppedTarget === `${category}-${item.id || itemKey(item)}` ? 'border-primary bg-primary/10 scale-105 shadow-lg' : 'border-border'}`}
                    >
                      <p className="font-medium">{item.name}</p>
                      {(item.company_name || item.branch_name || item.department_name) && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {[item.company_name, item.branch_name, item.department_name].filter(Boolean).join(' / ')}
                        </p>
                      )}
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
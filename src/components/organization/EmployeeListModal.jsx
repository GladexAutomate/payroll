import { useEffect, useMemo, useState } from 'react';
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
  const [dragPreviewPosition, setDragPreviewPosition] = useState(null);
  const [poppedTarget, setPoppedTarget] = useState(null);
  const [parentFilters, setParentFilters] = useState({ company: '', branch: '', department: '' });

  useEffect(() => {
    setParentFilters({ company: '', branch: '', department: '' });
  }, [category]);

  const companies = categories.company || [];
  const branches = categories.branch || [];
  const departments = categories.department || [];

  const availableBranches = useMemo(
    () => parentFilters.company ? branches.filter(branch => branch.company_id === parentFilters.company) : [],
    [branches, parentFilters.company]
  );

  const availableDepartments = useMemo(
    () => parentFilters.branch ? departments.filter(department => department.branch_id === parentFilters.branch) : [],
    [departments, parentFilters.branch]
  );

  const categoryItems = useMemo(() => {
    const items = categories[category] || [];
    if (category === 'branch') return parentFilters.company ? items.filter(item => item.company_id === parentFilters.company) : [];
    if (category === 'department') return parentFilters.branch ? items.filter(item => item.branch_id === parentFilters.branch) : [];
    if (category === 'department_role') return parentFilters.department ? items.filter(item => item.department_id === parentFilters.department) : [];
    if (category === 'team') {
      if (parentFilters.department) return items.filter(item => item.department_id === parentFilters.department);
      return [];
    }
    return items;
  }, [categories, category, parentFilters]);
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
    setDragPreviewPosition(null);
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
        <div className="fixed inset-0 z-[70] bg-black/40">
          <div className="bg-card w-screen h-screen flex flex-col overflow-hidden">
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

            <div className="grid md:grid-cols-[minmax(0,1fr)_420px] min-h-0 flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto overflow-x-hidden grid grid-cols-1 lg:grid-cols-3 gap-3 content-start border-r border-border min-w-0">
                {displayEmployees.length === 0 ? (
                  <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">No employees found.</div>
                ) : displayEmployees.map((employee, index) => (
                  <div
                    key={employee.id || employee.airtable_record_id || index}
                    draggable
                    onDragStart={(event) => {
                      setDraggingEmployee(employee);
                      setDraggingId(employee.airtable_record_id || employee.id);
                      setDragPreviewPosition({ x: event.clientX, y: event.clientY });
                      event.dataTransfer.effectAllowed = 'move';
                      const dragImage = new Image();
                      dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
                      event.dataTransfer.setDragImage(dragImage, 0, 0);
                    }}
                    onDrag={(event) => {
                      if (event.clientX && event.clientY) setDragPreviewPosition({ x: event.clientX, y: event.clientY });
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragPreviewPosition(null);
                    }}
                    className={`rounded-xl border p-3 cursor-grab active:cursor-grabbing bg-background transition-all duration-200 hover:border-primary/50 ${draggingId === (employee.airtable_record_id || employee.id) ? 'border-primary bg-primary/10 shadow-lg opacity-40' : 'border-border'}`}
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

              <div className="p-5 space-y-3 overflow-y-auto overflow-x-hidden bg-muted/20 min-w-0">
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

                {(category === 'branch' || category === 'department' || category === 'department_role' || category === 'team') && (
                  <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 overflow-hidden">
                    <p className="text-xs font-semibold text-muted-foreground">Choose parent location first</p>
                    <select
                      value={parentFilters.company}
                      onChange={(e) => setParentFilters({ company: e.target.value, branch: '', department: '' })}
                      className="block h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select company</option>
                      {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                    </select>
                    {(category === 'department' || category === 'department_role' || category === 'team') && (
                      <select
                        value={parentFilters.branch}
                        onChange={(e) => setParentFilters(prev => ({ ...prev, branch: e.target.value, department: '' }))}
                        disabled={!parentFilters.company}
                        className="block h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                      >
                        <option value="">Select branch</option>
                        {availableBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                      </select>
                    )}
                    {(category === 'department_role' || category === 'team') && (
                      <select
                        value={parentFilters.department}
                        onChange={(e) => setParentFilters(prev => ({ ...prev, department: e.target.value }))}
                        disabled={!parentFilters.branch}
                        className="block h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                      >
                        <option value="">Select department</option>
                        {availableDepartments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                      </select>
                    )}
                  </div>
                )}

                {saving && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Updating Airtable...</div>}

                <div className="space-y-2">
                  {categoryItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground text-center">
                      {category === 'company' ? 'No items in this category.' : 'Choose the parent location to show matching items.'}
                    </div>
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

      {draggingEmployee && dragPreviewPosition && (
        <div
          className="fixed z-[100] pointer-events-none w-[520px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-primary bg-primary/10 p-3 shadow-2xl scale-[1.02]"
          style={{ left: dragPreviewPosition.x, top: dragPreviewPosition.y }}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-primary" />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{employeeName(draggingEmployee)}</p>
              {(draggingEmployee.employee_code || draggingEmployee.employee_id || draggingEmployee.email) && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{draggingEmployee.employee_code || draggingEmployee.employee_id || draggingEmployee.email}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
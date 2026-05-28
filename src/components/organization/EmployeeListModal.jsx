import { X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const employeeName = (employee) => {
  const fullName = employee.full_name || [employee.first_name, employee.last_name].filter(Boolean).join(' ');
  return fullName || employee.employee_code || employee.employee_id || employee.email || 'Unnamed employee';
};

export default function EmployeeListModal({ employees, label = 'employees', title, open, onOpen, onClose }) {
  const count = employees.length;

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="text-xs text-primary hover:underline font-medium text-left"
      >
        {count} {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-border flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{count} {label}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 overflow-y-auto space-y-2">
              {count === 0 ? (
                <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                  No employees found.
                </div>
              ) : employees.map((employee, index) => (
                <div key={employee.id || employee.airtable_record_id || index} className="rounded-xl border border-border p-3">
                  <p className="font-medium text-sm">{employeeName(employee)}</p>
                  {(employee.employee_code || employee.employee_id || employee.email) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {employee.employee_code || employee.employee_id || employee.email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
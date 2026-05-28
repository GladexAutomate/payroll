import { useState } from 'react';
import { ChevronDown, ChevronRight, UserPlus } from 'lucide-react';

/**
 * Collapsible list of Employees that were auto-created during an upload
 * because their Person Code didn't match any existing Employee.
 */
export default function NewEmployeesList({ employees }) {
  const [open, setOpen] = useState(true);
  if (!employees || employees.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-blue-700" /> : <ChevronRight className="w-4 h-4 text-blue-700" />}
        <UserPlus className="w-4 h-4 text-blue-700" />
        <span className="text-sm font-medium text-blue-800">
          {employees.length} new employee{employees.length === 1 ? '' : 's'} added to the Employees page
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <p className="text-xs text-blue-700 mb-2">
            These employees were created automatically from new Person Codes in the file. Open the <strong>Employees</strong> page to fill in salary, department, and other details.
          </p>
          <div className="max-h-60 overflow-y-auto rounded-md border border-blue-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-blue-100/50 sticky top-0">
                <tr>
                  <th className="text-left py-1.5 px-2 font-medium text-blue-900">Person Code</th>
                  <th className="text-left py-1.5 px-2 font-medium text-blue-900">Name</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-t border-blue-100">
                    <td className="py-1 px-2 font-mono">{e.employee_id}</td>
                    <td className="py-1 px-2">{`${e.first_name} ${e.last_name}`.trim()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
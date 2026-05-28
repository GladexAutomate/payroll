import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

/**
 * Collapsible list of Person Codes from the uploaded file that didn't
 * match any employee in the Employee list. Shown after an upload finishes.
 */
export default function UnmatchedCodesList({ unmatched }) {
  const [open, setOpen] = useState(false);
  if (!unmatched || unmatched.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-orange-700" /> : <ChevronRight className="w-4 h-4 text-orange-700" />}
        <AlertTriangle className="w-4 h-4 text-orange-700" />
        <span className="text-sm font-medium text-orange-800">
          {unmatched.length} row{unmatched.length === 1 ? '' : 's'} skipped — no matching employee
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <p className="text-xs text-orange-700 mb-2">
            Add these to the <strong>Employees</strong> page (matching Person Code → Employee ID or Biometric ID) and re-upload to include them.
          </p>
          <div className="max-h-60 overflow-y-auto rounded-md border border-orange-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-orange-100/50 sticky top-0">
                <tr>
                  <th className="text-left py-1.5 px-2 font-medium text-orange-900">Person Code</th>
                  <th className="text-left py-1.5 px-2 font-medium text-orange-900">Name (from file)</th>
                  <th className="text-right py-1.5 px-2 font-medium text-orange-900">Rows</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map((u, i) => (
                  <tr key={i} className="border-t border-orange-100">
                    <td className="py-1 px-2 font-mono">{u.code || '—'}</td>
                    <td className="py-1 px-2">{u.name || '—'}</td>
                    <td className="py-1 px-2 text-right text-muted-foreground">{u.rowCount}</td>
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
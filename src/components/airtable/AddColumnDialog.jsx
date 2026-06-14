import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const FIELD_TYPES = [
  { value: 'singleLineText', label: 'Single line text' },
  { value: 'multilineText', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'phoneNumber', label: 'Phone number' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'date', label: 'Date' },
  { value: 'dateTime', label: 'Date & time' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'singleSelect', label: 'Single select' },
  { value: 'multipleSelects', label: 'Multi-select' },
  { value: 'rating', label: 'Rating' },
  { value: 'fileAttachment', label: 'File attachments' },
  { value: 'employeeSingleSelect', label: 'Single select (from employee list)' },
  { value: 'employeeMultiSelect', label: 'Multi-select (from employee list)' },
];

export default function AddColumnDialog({ onCancel, onCreate, employeeNames = [] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('singleLineText');
  const [choicesText, setChoicesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEmployeeList = type === 'employeeSingleSelect' || type === 'employeeMultiSelect';
  const needsChoices = type === 'singleSelect' || type === 'multipleSelects';

  const buildOptions = () => {
    if (isEmployeeList) {
      const choices = employeeNames.filter(Boolean).map(n => ({ name: n }));
      return { choices: choices.length ? choices : [{ name: 'Option 1' }] };
    }
    if (needsChoices) {
      const choices = choicesText
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(name => ({ name }));
      return choices.length ? { choices } : { choices: [{ name: 'Option 1' }] };
    }
    if (type === 'number') return { precision: 0 };
    if (type === 'currency') return { precision: 2, symbol: '$' };
    if (type === 'percent') return { precision: 0 };
    if (type === 'date') return { dateFormat: { name: 'iso' } };
    if (type === 'dateTime') return { dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' }, timeZone: 'client' };
    if (type === 'rating') return { max: 5, icon: 'star', color: 'yellowBright' };
    return undefined;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const realType = type === 'employeeSingleSelect' ? 'singleSelect'
        : type === 'employeeMultiSelect' ? 'multipleSelects'
        : type;
      await onCreate({ name: name.trim(), type: realType, options: buildOptions() });
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.details?.error?.message || err.message || 'Failed to create column');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-base">Add Column</h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Column Name</label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1"
              placeholder="e.g. Notes"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Field Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isEmployeeList && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              Dropdown choices will be filled with {employeeNames.length} employee name{employeeNames.length === 1 ? '' : 's'} from the current employee records. Pick a supervisor per record after creating the column.
            </div>
          )}
          {needsChoices && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Options (one per line or comma-separated)
              </label>
              <textarea
                value={choicesText}
                onChange={e => setChoicesText(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px]"
                placeholder="Option 1&#10;Option 2&#10;Option 3"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : 'Create Column'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
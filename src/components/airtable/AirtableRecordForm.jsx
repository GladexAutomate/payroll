import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AirtableSelectField from './AirtableSelectField';
import FileUploadField from './FileUploadField';
import { groupEmployeeColumns } from './employeeFieldGroups';

// Legacy known re-hosted file columns. Any column whose schema type is
// 'fileAttachment' is also rendered with the upload/view/download UI.
const KNOWN_FILE_FIELDS = new Set(['Contract Files', 'ATD Files']);

/**
 * Generic Airtable record form.
 * Renders an input for each editable column. Excludes computed/formula fields.
 */
export default function AirtableRecordForm({ record, allColumns, readOnlyFields, fieldsMeta = {}, companyChoices = [], fieldChoices = {}, employeeNames = [], onCancel, onSave }) {
  const employeeChoices = employeeNames.filter(Boolean).map(n => ({ name: String(n) }));
  // Match a column to its provided distinct-value choices case-insensitively
  // (e.g. "BRANCH" -> Branch, "DEPARTMENT ROLE" -> Department Role).
  const choiceKeyFor = (col) => Object.keys(fieldChoices).find((k) => k.toLowerCase() === String(col).toLowerCase());
  const isEditing = !!record?.id;
  const initialFields = record?.fields || {};

  // A column is a file column if it's a known one, has the fileAttachment schema type,
  // or already stores re-hosted file objects ({ file_uri }).
  const isFileField = (col) =>
    KNOWN_FILE_FIELDS.has(col) ||
    fieldsMeta[col]?.type === 'fileAttachment' ||
    (Array.isArray(initialFields[col]) && initialFields[col].some((v) => v && typeof v === 'object' && v.file_uri));

  // Build editable column list
  const editableCols = useMemo(() => {
    return allColumns.filter(c => !readOnlyFields.has(c));
  }, [allColumns, readOnlyFields]);

  const [values, setValues] = useState(() => {
    const v = {};
    for (const c of editableCols) {
      const raw = initialFields[c];
      if (isFileField(c)) { v[c] = Array.isArray(raw) ? raw : []; continue; }
      if (raw == null) v[c] = '';
      else if (Array.isArray(raw)) {
        // Attachments: keep as JSON string so user can see and we send as-is on save
        v[c] = raw[0]?.url ? raw : (raw.join(', '));
      } else if (typeof raw === 'object') {
        v[c] = JSON.stringify(raw);
      } else {
        v[c] = raw;
      }
    }
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Fields auto-detected as computed during this session — stripped from payload
  const [skipFields, setSkipFields] = useState(new Set());

  const handleChange = (col, val) => {
    setValues(prev => ({ ...prev, [col]: val }));
  };

  const buildPayload = (extraSkip) => {
    const payload = {};
    for (const col of editableCols) {
      if (extraSkip.has(col)) continue;
      const orig = initialFields[col];
      const curr = values[col];

      // Re-hosted file fields: save the current array as-is (added/removed files).
      if (isFileField(col)) {
        if (Array.isArray(curr) && (curr.length > 0 || (Array.isArray(orig) && orig.length > 0))) {
          payload[col] = curr;
        }
        continue;
      }

      // Skip attachment fields if unchanged (don't try to re-upload)
      if (Array.isArray(orig) && orig[0]?.url && curr === orig) continue;
      // Skip empty fields on create
      if (!isEditing && (curr === '' || curr == null)) continue;

      if (curr === '' || curr == null) {
        if (isEditing && orig != null) payload[col] = null;
        continue;
      }
      payload[col] = curr;
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Auto-retry: if Airtable rejects a computed field, strip it and try again.
    let currentSkip = new Set(skipFields);
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await onSave(buildPayload(currentSkip), record?.id);
        setSkipFields(currentSkip);
        return;
      } catch (err) {
        const msg = err?.response?.data?.error || err.message || 'Save failed';
        // Match: Field "X" cannot accept a value because the field is computed
        const m = String(msg).match(/Field "([^"]+)" cannot accept a value because the field is computed/i);
        if (m && !currentSkip.has(m[1])) {
          currentSkip.add(m[1]);
          continue; // retry without the computed field
        }
        setError(msg);
        setSkipFields(currentSkip);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
  };

  // Order columns into HR sections (Identity, Job & Org, Compensation, etc.)
  const groupedCols = useMemo(() => groupEmployeeColumns(editableCols), [editableCols]);

  const renderField = (col) => {
    const fileField = isFileField(col);
    const isAttachment = !fileField && Array.isArray(initialFields[col]) && initialFields[col][0]?.url;
    const meta = fieldsMeta[col];
    const isCompanyField = col.toLowerCase() === 'company';
    const isSingleSelect = meta?.type === 'singleSelect';
    const isMultiSelect = meta?.type === 'multipleSelects';
    const choiceKey = choiceKeyFor(col);
    const orgChoices = (!fileField && !isAttachment && !isCompanyField && choiceKey) ? fieldChoices[choiceKey] : null;
    return (
      <div key={col} className={(fileField || isAttachment) ? 'md:col-span-2' : ''}>
        <label className="text-xs font-medium text-muted-foreground">{col}</label>
        {fileField ? (
          <FileUploadField
            value={values[col]}
            onChange={(v) => handleChange(col, v)}
          />
        ) : isAttachment ? (
          <div className="mt-1 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
            Attachment(s): {initialFields[col].map(a => a.filename).join(', ')}
            <p className="mt-1 text-[10px]">Attachments must be managed directly in Airtable.</p>
          </div>
        ) : (isCompanyField && companyChoices.length > 0) ? (
          <AirtableSelectField
            value={values[col]}
            onChange={(v) => handleChange(col, v)}
            choices={companyChoices}
            multi={false}
          />
        ) : orgChoices ? (
          <AirtableSelectField
            value={values[col]}
            onChange={(v) => handleChange(col, v)}
            choices={orgChoices}
            multi={false}
          />
        ) : (isSingleSelect || isMultiSelect) ? (
          <AirtableSelectField
            value={values[col]}
            onChange={(v) => handleChange(col, v)}
            choices={(meta.choices && meta.choices.length) ? meta.choices : employeeChoices}
            multi={isMultiSelect}
          />
        ) : (
          <Input
            value={typeof values[col] === 'object' ? '' : (values[col] ?? '')}
            onChange={e => handleChange(col, e.target.value)}
            className="mt-1"
            placeholder=""
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-base">
              {isEditing ? 'Edit Record' : 'New Record'}
            </h3>
            {isEditing && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {initialFields['Full Name'] || initialFields['Employee Code ID'] || record.id}
              </p>
            )}
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <strong>Error:</strong> {error}
              </div>
            )}

            {groupedCols.map(({ group, columns }) => (
              <div key={group} className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 border-b border-border pb-1">
                  {group}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {columns.map(col => renderField(col))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Record')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
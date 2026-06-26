import { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AirtableSelectField from './AirtableSelectField';
import FileUploadField from './FileUploadField';
import { groupEmployeeColumns } from './employeeFieldGroups';

// Legacy known re-hosted file columns. Any column whose schema type is
// 'fileAttachment' is also rendered with the upload/view/download UI.
const KNOWN_FILE_FIELDS = new Set(['Contract Files', 'ATD Files']);

// "Immediate Head" is keyed on FIRST + LAST name only (middle names/initials dropped),
// matching how the Schedule Proposal page maps employees to their leader. Source casing
// is preserved so the dropdown reads naturally.
const firstLastName = (value) => {
  const tokens = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (tokens.length <= 1) return tokens.join(' ');
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
};

// Normalized match key (first + last token, letters only, uppercased) used to recognize
// a legacy Immediate Head text value as one of the canonical employee options.
const headMatchKey = (value) => {
  const tokens = String(value || '')
    .toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean);
  if (!tokens.length) return '';
  if (tokens.length === 1) return tokens[0];
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
};

/**
 * Generic Airtable record form.
 * Renders an input for each editable column. Excludes computed/formula fields.
 */
export default function AirtableRecordForm({ record, allColumns, readOnlyFields, fieldsMeta = {}, companyChoices = [], fieldChoices = {}, employeeNames = [], headNames = [], onCancel, onSave }) {
  const employeeChoices = employeeNames.filter(Boolean).map(n => ({ name: String(n) }));

  // "First Last" options for the Immediate Head dropdown. Prefer the dedicated headNames
  // list (built from real First Name + Last Name fields, so compound surnames stay intact);
  // fall back to trimming full names if it isn't available. De-duplicated by match key.
  const headOptions = useMemo(() => {
    const source = (headNames && headNames.length)
      ? headNames.map(n => String(n || '').replace(/\s+/g, ' ').trim())
      : employeeNames.map(n => firstLastName(n));
    const byKey = new Map();
    for (const name of source) {
      if (!name) continue;
      const key = headMatchKey(name);
      if (key && !byKey.has(key)) byKey.set(key, name);
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b)).map(name => ({ name }));
  }, [headNames, employeeNames]);

  // Resolve an existing Immediate Head value to its canonical employee option (matched
  // by first + last name). Returns the original first+last text when there's no match,
  // so legacy values are never lost — just standardized.
  const canonicalHead = useMemo(() => {
    const byKey = new Map(headOptions.map(o => [headMatchKey(o.name), o.name]));
    return (value) => {
      const key = headMatchKey(value);
      if (!key) return '';
      return byKey.get(key) || firstLastName(value);
    };
  }, [headOptions]);
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

  // The Immediate Head column (case-insensitive), rendered as an employee dropdown.
  const immediateHeadCol = useMemo(
    () => editableCols.find(c => c.toLowerCase() === 'immediate head') || null,
    [editableCols]
  );

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

  // Once the employee list is available, snap the existing Immediate Head value to its
  // canonical first+last option so legacy text values map onto the dropdown (and persist
  // standardized on save). Unmatched values are kept as-is.
  useEffect(() => {
    if (!immediateHeadCol) return;
    setValues(prev => {
      const mapped = canonicalHead(prev[immediateHeadCol]);
      return mapped === prev[immediateHeadCol] ? prev : { ...prev, [immediateHeadCol]: mapped };
    });
  }, [immediateHeadCol, canonicalHead]);

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

  // Find the actual Status column name (case-insensitive) so it can be pinned to the top.
  const statusCol = useMemo(
    () => editableCols.find(c => c.toLowerCase() === 'status'),
    [editableCols]
  );

  // Order columns into HR sections (Identity, Job & Org, Compensation, etc.),
  // excluding Status since it's surfaced at the very top of the form.
  const groupedCols = useMemo(
    () => groupEmployeeColumns(editableCols.filter(c => c !== statusCol)),
    [editableCols, statusCol]
  );

  const STATUS_OPTIONS = ['Active', 'Resigned'];

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
        ) : (immediateHeadCol && col === immediateHeadCol) ? (
          <AirtableSelectField
            value={values[col]}
            onChange={(v) => handleChange(col, v)}
            choices={headOptions}
            multi={false}
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

            {statusCol && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-primary">{statusCol}</label>
                <AirtableSelectField
                  value={values[statusCol]}
                  onChange={(v) => handleChange(statusCol, v)}
                  choices={
                    (fieldsMeta[statusCol]?.choices && fieldsMeta[statusCol].choices.length)
                      ? fieldsMeta[statusCol].choices
                      : STATUS_OPTIONS.map(name => ({ name }))
                  }
                  multi={false}
                />
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
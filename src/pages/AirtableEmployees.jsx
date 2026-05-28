import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Trash2, Loader2, RefreshCw, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import AirtableRecordForm from '@/components/airtable/AirtableRecordForm';
import TableWithTopScrollbar from '@/components/airtable/TableWithTopScrollbar';
import EditableColumnHeader from '@/components/airtable/EditableColumnHeader';
import AddColumnDialog from '@/components/airtable/AddColumnDialog';

// Fields that are computed by Airtable — we hide them from the create/edit form
const READ_ONLY_FIELDS = new Set([
  'RECORD ID',
  'Calculated Employment Status',
  'Tenure(Months)',
  'New Formula Column',
  'Employee Code', // formula, mirrored from Employee Code ID
  'Full Name', // computed from First + Middle + Last Name
  'Employee #', // auto-number
  'Birth Month', // computed from Birthday
  'Age', // computed from Birthday
  'Years of Service', // computed from Date Hired
  'Tenure', // computed from Date Hired
]);

const PAGE_SIZE = 50;

export default function AirtableEmployees() {
  const [records, setRecords] = useState([]);       // all loaded records (across fetched pages)
  const [offsetStack, setOffsetStack] = useState([null]); // history of offsets per fetched page
  const [nextOffset, setNextOffset] = useState(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // record or {} for new
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [fieldsMeta, setFieldsMeta] = useState({}); // schema: { fieldName: { type, choices } }
  const [showAddColumn, setShowAddColumn] = useState(false);

  const loadPage = async (offset = null, searchQuery = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('airtableEmployees', {
        action: 'list',
        pageSize: PAGE_SIZE,
        offset: offset || undefined,
        search: searchQuery || undefined,
      });
      setRecords(res.data.records || []);
      setNextOffset(res.data.offset || null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load records');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch schema once to get dropdown choices for single/multi-select fields
  const loadSchema = async () => {
    try {
      const res = await base44.functions.invoke('airtableEmployees', { action: 'schema' });
      setFieldsMeta(res.data?.fieldsMeta || {});
    } catch {}
  };
  useEffect(() => { loadSchema(); }, []);

  const handleRenameColumn = async (oldName, newName) => {
    await base44.functions.invoke('airtableEmployees', {
      action: 'renameField', fieldName: oldName, newName,
    });
    await loadSchema();
    const currentOffset = offsetStack[pageIdx];
    await loadPage(currentOffset, search);
  };

  const handleAddColumn = async ({ name, type, options }) => {
    const res = await base44.functions.invoke('airtableEmployees', {
      action: 'createField', name, type, options,
    });
    setFieldsMeta(prev => ({
      ...prev,
      [res.data?.field?.name || name]: { type },
    }));
    setShowAddColumn(false);
    await loadSchema();
    const currentOffset = offsetStack[pageIdx];
    await loadPage(currentOffset, search);
  };

  // Debounce search — when user types, reset pagination and search Airtable server-side
  useEffect(() => {
    const t = setTimeout(() => {
      setOffsetStack([null]);
      setPageIdx(0);
      loadPage(null, search);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleNext = async () => {
    if (!nextOffset) return;
    const newStack = [...offsetStack, nextOffset];
    setOffsetStack(newStack);
    setPageIdx(newStack.length - 1);
    await loadPage(nextOffset, search);
  };

  const handlePrev = async () => {
    if (pageIdx === 0) return;
    const newIdx = pageIdx - 1;
    setPageIdx(newIdx);
    const offset = offsetStack[newIdx];
    setOffsetStack(offsetStack.slice(0, newIdx + 1));
    await loadPage(offset, search);
  };

  const handleRefresh = async () => {
    setOffsetStack([null]);
    setPageIdx(0);
    await loadSchema();
    await loadPage(null, search);
  };

  const handleSave = async (fields, recordId) => {
    const res = recordId
      ? await base44.functions.invoke('airtableEmployees', { action: 'update', recordId, fields })
      : await base44.functions.invoke('airtableEmployees', { action: 'create', fields });

    if (res.data?.record) {
      setRecords(prev => recordId
        ? prev.map(record => record.id === recordId ? res.data.record : record)
        : [res.data.record, ...prev.filter(record => record.id !== res.data.record.id)].slice(0, PAGE_SIZE)
      );
    }

    setShowForm(false);
    setEditing(null);
    await loadSchema();
  };

  const handleDelete = async (recordId) => {
    setDeletingId(recordId);
    await base44.functions.invoke('airtableEmployees', { action: 'delete', recordId });
    setDeletingId(null);
    const currentOffset = offsetStack[pageIdx];
    await loadPage(currentOffset, search);
  };

  // Show all Airtable schema columns, including empty/new columns not returned on records
  const columns = useMemo(() => {
    const cols = new Set(Object.keys(fieldsMeta));
    for (const r of records) {
      for (const k of Object.keys(r.fields || {})) cols.add(k);
    }
    const arr = Array.from(cols);
    const priority = ['Employee Code ID', 'Company', 'COMPANY', 'Full Name', 'First Name', 'Last Name', 'Branch', 'BRANCH', 'Department', 'DEPARTMENT', 'Department Role', 'DEPARTMENT ROLE', 'Job Title', 'Status'];
    arr.sort((a, b) => {
      const ia = priority.findIndex(item => item.toLowerCase() === a.toLowerCase());
      const ib = priority.findIndex(item => item.toLowerCase() === b.toLowerCase());
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
    return arr;
  }, [records, fieldsMeta]);

  // Server-side search means records returned are already filtered
  const filteredRecords = records;

  const renderCell = (value) => {
    if (value == null || value === '') return <span className="text-muted-foreground/40">—</span>;
    if (Array.isArray(value)) {
      // Attachments or linked records
      if (value[0]?.url) {
        return (
          <div className="flex gap-1 flex-wrap">
            {value.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                {att.filename || `file ${i + 1}`}
              </a>
            ))}
          </div>
        );
      }
      return <span className="text-xs">{value.join(', ')}</span>;
    }
    if (typeof value === 'object') return <span className="text-xs text-muted-foreground">{JSON.stringify(value)}</span>;
    const str = String(value);
    return <span title={str}>{str.length > 60 ? str.slice(0, 60) + '…' : str}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search backend employee records..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowAddColumn(true)} disabled={loading}>
            <Columns3 className="w-4 h-4 mr-1.5" /> Add Column
          </Button>
          <Button onClick={() => { setEditing({}); setShowForm(true); }} disabled={loading}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Record
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table */}
      <TableWithTopScrollbar resetKey={`${pageIdx}-${records[0]?.id || 'empty'}-${columns.join('|')}`}>
          <table className="text-xs min-w-full">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="sticky left-0 z-20 bg-muted py-2.5 px-3 text-left font-medium text-muted-foreground uppercase tracking-wide border-b border-r border-border min-w-[100px]">
                  Actions
                </th>
                {columns.map(col => (
                  <th key={col} className="py-2.5 px-3 text-left font-medium text-muted-foreground uppercase tracking-wide border-b border-border whitespace-nowrap min-w-[140px]">
                    <EditableColumnHeader name={col} onRename={handleRenameColumn} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-16 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                    Loading records from backend database...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-16 text-muted-foreground">
                    {records.length === 0 ? 'No records found.' : 'No records match your search.'}
                  </td>
                </tr>
              ) : filteredRecords.map(rec => (
                <tr key={rec.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-card hover:bg-muted/20 py-1.5 px-3 border-r border-border">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditing(rec); setShowForm(true); }}
                        className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                            title="Delete"
                            disabled={deletingId === rec.id}
                          >
                            {deletingId === rec.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete <strong>{rec.fields?.['Full Name'] || rec.fields?.['Employee Code ID'] || rec.id}</strong> from Airtable. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(rec.id)}
                            >
                              Delete Permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                  {columns.map(col => (
                    <td key={col} className="py-1.5 px-3 border-r border-border/30 whitespace-nowrap">
                      {renderCell(rec.fields?.[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
      </TableWithTopScrollbar>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Page {pageIdx + 1} · {records.length} records
          {search && ` matching "${search}"`}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev} disabled={pageIdx === 0 || loading}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext} disabled={!nextOffset || loading}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <AirtableRecordForm
          record={editing}
          allColumns={columns}
          readOnlyFields={READ_ONLY_FIELDS}
          fieldsMeta={fieldsMeta}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {/* Add Column Modal */}
      {showAddColumn && (
        <AddColumnDialog
          onCancel={() => setShowAddColumn(false)}
          onCreate={handleAddColumn}
        />
      )}
    </div>
  );
}
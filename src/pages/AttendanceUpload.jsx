import { useState, useEffect, useRef } from 'react';
import { useUpload } from '@/context/UploadContext';
import { base44 } from '@/api/base44Client';
import { Upload, FileSpreadsheet, Trash2, AlertTriangle, CheckCircle, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, getDaysInMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import NewEmployeesList from '@/components/attendance/NewEmployeesList';
import UploadTimer from '@/components/attendance/UploadTimer';

const APP_TIME_ZONE = 'Asia/Manila';
const phDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const formatPhilippineDateTime = (dateValue) => dateValue ? phDateTimeFormatter.format(new Date(dateValue)) : '—';

// Ids of imports currently being driven by a poll loop in THIS browser tab. Kept at
// module scope so it survives the page component unmounting/remounting during in-app
// navigation — used to guarantee at most one poll loop per import per tab.
const activeDrives = new Set();

// Don't try to resume an import that's been sitting in "processing" longer than this
// (a genuinely abandoned/stuck record), so returning to the page can't revive an
// ancient import unexpectedly.
const RESUME_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export default function AttendanceUpload() {
  const { uploadState, startUpload, updateProgress, finishUpload, clearUpload } = useUpload();
  const uploading = uploadState?.uploading || false;
  const uploadProgress = uploadState?.progress || { current: 0, total: 0, saved: 0 };
  const uploadResult = uploadState?.result || null;

  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [previewUpload, setPreviewUpload] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const pollRef = useRef(null);

  useEffect(() => { loadUploads(); }, []);

  // Resume an in-progress import when returning to the page (or after a reload). If a
  // poll loop is already driving it in this tab, the context state still shows progress
  // and we do nothing; otherwise (e.g. the tab was reloaded and the loop was lost) we
  // re-show the progress from the server record and resume driving it from where it
  // stopped — so navigating away never leaves the user unsure if the upload is alive.
  useEffect(() => {
    if (uploading) return; // a poll loop is already active in this tab
    let cancelled = false;
    (async () => {
      try {
        const active = await base44.entities.AttendanceUpload.filter({ status: 'processing' }, '-created_date', 1);
        const rec = active?.[0];
        if (cancelled || !rec || activeDrives.has(rec.id)) return;
        const ageMs = Date.now() - new Date(rec.created_date).getTime();
        if (!Number.isFinite(ageMs) || ageMs > RESUME_MAX_AGE_MS) return;
        startUpload(rec.filename, '');
        updateProgress({
          current: rec.processed_rows || 0,
          total: rec.total_rows || 0,
          saved: rec.processed_rows || 0,
          percent: rec.total_rows ? Math.round(((rec.processed_rows || 0) / rec.total_rows) * 100) : 0,
        });
        driveImport(rec.id, rec.processed_rows || 0);
      } catch { /* nothing to resume */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear any running poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Prevent navigation during upload
  useEffect(() => {
    if (!uploading) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploading]);

  const loadUploads = async () => {
    setLoading(true);
    const data = await base44.entities.AttendanceUpload.list('-created_date', 50);
    setUploads(data.filter(upload => upload.status !== 'deleting' && upload.status !== 'deleted'));
    setLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return; // don't start a second import while one is already running
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = async (file) => {
    // Clear any previous upload state first
    clearUpload();

    // Validate file type upfront
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      finishUpload({ error: `Unsupported file type: .${ext}. Please upload a .xlsx, .xls, or .csv file and try again.` });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    startUpload(file.name, '');

    try {
      await runImport(file);
    } catch (err) {
      finishUpload({ error: String(err?.message || err) });
      loadUploads();
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const finishFromRecord = (rec) => {
    if (rec.status === 'failed') {
      finishUpload({ error: rec.error_message || 'Import failed.' });
    } else {
      finishUpload({
        saved: rec.records_imported || 0,
        skipped: 0,
        period: rec.period_label,
        createdEmployees: rec.new_employees || [],
      });
    }
    loadUploads();
    if (fileRef.current) fileRef.current.value = '';
  };

  // Drive the import forward one batch at a time. Each processBatch call runs
  // inside its own live request, so nothing gets killed mid-flight. We chain
  // batches until the import reports done.
  const driveImport = async (uploadId, startOffset = 0) => {
    // At most one poll loop per import per tab — prevents a second loop starting when
    // the user returns to the page (or a resume check fires) while one is still running.
    if (activeDrives.has(uploadId)) return;
    activeDrives.add(uploadId);
    try {
      let offset = startOffset;
      while (true) {
        const res = await base44.functions.invoke('importAttendance', {
          action: 'processBatch', uploadId, offset,
        });
        const data = res.data || {};

        if (data.error) {
          finishUpload({ error: data.error });
          loadUploads();
          if (fileRef.current) fileRef.current.value = '';
          return;
        }

        if (data.phase === 'delete') {
          // Still clearing old records — keep the bar moving without advancing offset.
          updateProgress({ current: 0, total: data.total || 0, saved: 0, percent: 0, deleting: true });
          continue;
        }

        updateProgress({
          current: data.processed || 0,
          total: data.total || 0,
          saved: data.processed || 0,
          percent: data.total ? Math.round((data.processed / data.total) * 100) : 0,
        });

        if (data.done) {
          const rec = await base44.entities.AttendanceUpload.get(uploadId);
          finishFromRecord(rec);
          return;
        }
        offset = data.nextOffset ?? (offset + 40);
      }
    } finally {
      activeDrives.delete(uploadId);
    }
  };

  const runImport = async (file) => {
    // Upload the raw file ONCE — this single upload is reliable.
    const uploadRes = await base44.integrations.Core.UploadFile({ file });
    const fileUrl = uploadRes?.file_url || uploadRes?.data?.file_url || uploadRes?.url;
    if (!fileUrl) throw new Error('File upload failed — no file URL returned. Please try again.');

    // Create the upload record + parse the file + auto-create employees.
    const res = await base44.functions.invoke('importAttendance', {
      action: 'startImport',
      filename: file.name,
      fileUrl,
    });
    const uploadId = res.data?.uploadId;
    if (!uploadId) throw new Error(res.data?.error || 'Could not start import.');
    if (res.data?.error) throw new Error(res.data.error);

    updateProgress({ current: 0, total: res.data?.total || 0, saved: 0, percent: 0 });
    loadUploads();

    if (res.data?.done) {
      const rec = await base44.entities.AttendanceUpload.get(uploadId);
      finishFromRecord(rec);
      return;
    }

    // Process the import batch-by-batch until complete.
    await driveImport(uploadId);
  };

  const [templateMonth, setTemplateMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const downloadTemplate = () => {
    const [year, month] = templateMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy');

    // Build header row: Person Code, Name, then each day as MM-DD
    const headers = ['Person Code', 'Name'];
    for (let d = 1; d <= daysInMonth; d++) {
      headers.push(`${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }

    // Sample rows
    const rows = [
      ['EMP001', 'Juan Dela Cruz', ...Array(daysInMonth).fill('')],
      ['EMP002', 'Maria Santos', ...Array(daysInMonth).fill('')],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Style header row width hints
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, ...Array(daysInMonth).fill({ wch: 12 })];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, monthLabel);
    XLSX.writeFile(wb, `Attendance_Template_${templateMonth}.xlsx`);
  };

  const handleDelete = async (upload) => {
    setDeletingId(upload.id);
    await base44.functions.invoke('importAttendance', { action: 'delete', uploadId: upload.id });
    setDeletingId(null);
    loadUploads();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Upload Zone */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold text-base mb-1">Upload Attendance Excel</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Upload the monthly punch record Excel exported from your biometric software (ZKBioTime / Yunatt). Accepts .xlsx, .xls, or .csv files.
        </p>

        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-primary/5'}`}
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          {uploading ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-sm">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              {uploadProgress.deleting ? (
                <div className="w-full text-center">
                  <p className="text-sm font-medium">Clearing previous records for this period…</p>
                  <p className="text-xs text-muted-foreground mt-1">Preparing a clean import. This finishes shortly.</p>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-primary/60 rounded-full animate-pulse w-1/3" />
                  </div>
                  <UploadTimer startedAt={uploadState?.startedAt} />
                </div>
              ) : uploadProgress.total > 0 ? (
                <>
                  <div className="w-full">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Importing {uploadProgress.current} of {uploadProgress.total} records</span>
                      <span>{uploadProgress.saved} saved</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${uploadProgress.percent || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 text-center">
                      {uploadProgress.percent || 0}% complete
                    </p>
                  </div>
                  <UploadTimer startedAt={uploadState?.startedAt} />
                  <p className="text-[11px] text-muted-foreground text-center">
                    You can keep using other pages in the app while this runs — just keep this browser tab open until it finishes.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Uploading file & starting import...</p>
                  <p className="text-xs text-muted-foreground">Reading punch records on the server...</p>
                  <UploadTimer startedAt={uploadState?.startedAt} />
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{dragOver ? 'Drop to upload' : 'Drag & drop or click to select file'}</p>
                <p className="text-xs text-muted-foreground mt-1">Supports ZKBioTime / Yunatt monthly attendance export (.xlsx, .xls, .csv)</p>
              </div>
              <Button size="sm" variant="outline">
                <Upload className="w-4 h-4 mr-1.5" /> Browse File
              </Button>
            </div>
          )}
        </div>

        {/* Upload Result */}
        {uploadResult && !uploading && (
          <div className={`mt-4 rounded-xl p-4 flex items-start gap-3 ${uploadResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            {uploadResult.error ? (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              {uploadResult.error ? (
                <p className="text-sm font-medium text-red-800">Failed to parse file: {uploadResult.error}</p>
              ) : uploadResult.saved === 0 ? (
                <div>
                  <p className="text-sm font-medium text-orange-800">⚠️ No records imported</p>
                  <p className="text-xs text-orange-700 mt-1">
                    No time data was found in the date cells. Please fill in time pairs (e.g. <strong>08:00 / 17:00</strong>) before uploading.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-green-800">
                    Successfully imported {uploadResult.saved} attendance records
                    {uploadResult.period && ` for ${uploadResult.period}`}
                  </p>
                  {uploadResult.skipped > 0 && (
                    <p className="text-xs text-green-700 mt-1">{uploadResult.skipped} rows skipped (no matching employee)</p>
                  )}
                </>
              )}
              <NewEmployeesList employees={uploadResult.createdEmployees} />
            </div>
            <button onClick={clearUpload} className="ml-2 shrink-0 text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
          </div>
        )}

        {/* Format hint */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 font-medium mb-1">📋 Expected Format</p>
          <p className="text-xs text-blue-700">
            The file should have columns for: <strong>Person Code</strong>, <strong>Name</strong>, and dates as columns (e.g. 05-01, 05-02...) with time pairs (IN/OUT) in each cell. This matches the standard ZKBioTime / Yunatt monthly export format.
          </p>
          <p className="text-xs text-blue-700 mt-2 font-medium">
            Supported formats: <strong>.xlsx</strong>, <strong>.xls</strong>, and <strong>.csv</strong>.
          </p>
        </div>
      </div>

      {/* Template Download */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold text-base mb-1">Download Attendance Template</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Generate a blank template for a specific month. Fill in the time pairs (e.g. <code className="bg-muted px-1 rounded text-xs">08:00 / 17:00</code>) for each day column, then upload it above.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Month / Year</label>
            <input
              type="month"
              value={templateMonth}
              onChange={(e) => setTemplateMonth(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col justify-end pt-5">
            <Button onClick={downloadTemplate} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Download Template
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Template columns: <strong>Person Code</strong>, <strong>Name</strong>, then one column per day (e.g. 05-01, 05-02…). Each cell accepts time pairs like <code className="bg-muted px-1 rounded">08:00 / 17:00</code>.
        </p>
      </div>

      {/* Upload History */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm">Upload History</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Deleting an upload will permanently remove all attendance records imported from that file.</p>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}</div>
        ) : uploads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No uploads yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {uploads.map(upload => (
              <div key={upload.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{upload.filename}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {formatPhilippineDateTime(upload.created_date)}
                    </span>
                    {upload.period_label && <span className="text-xs text-muted-foreground">· {upload.period_label}</span>}
                    <span className="text-xs font-medium text-green-700">{upload.records_imported || 0} records</span>
                    {upload.notes && <span className="text-xs text-orange-600">{upload.notes}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">by {upload.uploaded_by}</p>
                </div>

                {deletingId === upload.id ? (
                  <div className="p-2 shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors shrink-0" disabled={!!deletingId}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Upload & Records?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>{upload.records_imported || 0} attendance records</strong> imported from <strong>{upload.filename}</strong>. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(upload)}
                        >
                          Delete Permanently
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
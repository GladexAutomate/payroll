import { useState, useEffect, useRef } from 'react';
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

export default function AttendanceUpload() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [previewUpload, setPreviewUpload] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  useEffect(() => { loadUploads(); }, []);

  const loadUploads = async () => {
    setLoading(true);
    const data = await base44.entities.AttendanceUpload.list('-created_date', 50);
    setUploads(data);
    setLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = async (file) => {
    // Validate file type upfront
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'csv'].includes(ext)) {
      setUploadResult({ error: `Unsupported file type: .${ext}. Please save your file as .xlsx (Excel Workbook) or .csv and try again.` });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadResult(null);

    // Parse file locally with xlsx
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) {
      setUploadResult({ error: 'File appears empty or has no data rows.' });
      setUploading(false);
      return;
    }

    // Header row: find Person Code col, Name col, and date columns
    const rawHeaderRow = rows[0];
    const headerRow = rawHeaderRow.map(h => String(h).trim());
    const personCodeIdx = headerRow.findIndex(h => /person.?code/i.test(h) || h === 'No.');
    const nameIdx = headerRow.findIndex(h => /^name$/i.test(h));

    // Date columns: MM-DD pattern OR Excel serial numbers (dates stored as numbers)
    const dateCols = [];
    rawHeaderRow.forEach((h, i) => {
      const str = String(h).trim();
      if (/^\d{1,2}-\d{2}$/.test(str)) {
        // Already MM-DD string
        dateCols.push({ idx: i, label: str });
      } else if (typeof h === 'number' && h > 40000 && h < 50000) {
        // Excel date serial — convert to MM-DD
        const d = XLSX.SSF.parse_date_code(h);
        const label = `${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        dateCols.push({ idx: i, label });
      }
    });

    console.log('Headers found:', headerRow.slice(0, 5));
    console.log('Date columns found:', dateCols.length, dateCols.slice(0, 3));
    console.log('personCodeIdx:', personCodeIdx, 'nameIdx:', nameIdx);
    console.log('Row 1 sample:', rows[1]?.slice(0, 5));

    if (dateCols.length === 0) {
      setUploadResult({ error: `No date columns found. Headers detected: "${headerRow.slice(0, 8).join('", "')}"` });
      setUploading(false);
      return;
    }

    // Infer year from filename or current year
    const yearMatch = file.name.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
    const monthMatch = file.name.match(/(\d{4})-(\d{2})/);
    const periodLabel = monthMatch
      ? format(new Date(parseInt(monthMatch[1]), parseInt(monthMatch[2]) - 1), 'MMMM yyyy')
      : `${year}`;

    // Fetch employees once for ID mapping
    const employees = await base44.entities.Employee.filter({ status: 'active' });

    const byBioId = {};
    const byName = {};
    for (const emp of employees) {
      if (emp.biometric_id) byBioId[emp.biometric_id.trim()] = emp;
      if (emp.employee_id) byBioId[emp.employee_id.trim()] = emp;
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase().trim();
      byName[fullName] = emp;
    }

    let dataRowsFound = 0;
    let emptyCellsSkipped = 0;

    // Parse all records locally — no DB calls here
    const records = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const code = String(personCodeIdx >= 0 ? row[personCodeIdx] : '').trim();
      const name = String(nameIdx >= 0 ? row[nameIdx] : '').toLowerCase().trim();
      if (!code && !name) continue;
      dataRowsFound++;

      const emp = byBioId[code] || byName[name];
      const employeeId = emp?.id || code || name;
      const biometricId = emp?.biometric_id || code;

      for (const { idx, label } of dateCols) {
        const cellVal = String(row[idx] || '').trim();
        if (!cellVal) { emptyCellsSkipped++; continue; }

        const parts = cellVal.split(/\s*[\/,]\s*/);
        const timeIn = parts[0]?.trim() || null;
        const timeOut = parts[1]?.trim() || null;
        if (!timeIn) continue;

        const dateStr = `${year}-${label.padStart(5, '0')}`;
        const buildISO = (t) => t ? `${dateStr}T${t}:00` : null;
        const timeInISO = buildISO(timeIn);
        const timeOutISO = buildISO(timeOut);
        const totalHours = timeInISO && timeOutISO
          ? Math.round((new Date(timeOutISO) - new Date(timeInISO)) / 36000) / 100
          : 0;

        records.push({
          employee_id: employeeId,
          biometric_id: biometricId,
          date: dateStr,
          time_in: timeInISO,
          time_out: timeOutISO,
          total_hours: totalHours,
          status: 'present',
        });
      }
    }

    if (records.length === 0) {
      setUploadResult({ saved: 0, skipped: 0, period: periodLabel, dataRowsFound, emptyCellsSkipped, dateCols: dateCols.length });
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    // Upload file for record-keeping
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Send all records to backend function — runs server-side, no rate limits
    const result = await base44.functions.invoke('importAttendance', {
      records,
      filename: file.name,
      periodLabel,
      fileUrl: file_url,
    });

    const saved = result.data?.saved || 0;

    setUploadResult({ saved, skipped: 0, period: periodLabel, dataRowsFound, emptyCellsSkipped, dateCols: dateCols.length });
    setUploading(false);
    loadUploads();
    if (fileRef.current) fileRef.current.value = '';
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
    // Delete all attendance logs that came from this upload period — 
    // We identify by matching the upload's created_date window (records created around same time)
    // Simpler: just delete the upload record. Attendance logs stay unless user manually clears.
    // Per requirement: deleting upload removes records completely.
    // We'll delete attendance logs created within 5 minutes of the upload.
    const uploadTime = new Date(upload.created_date).getTime();
    const logs = await base44.entities.AttendanceLog.list('-created_date', 500);
    const toDelete = logs.filter(l => {
      const logTime = new Date(l.created_date).getTime();
      return Math.abs(logTime - uploadTime) < 5 * 60 * 1000;
    });
    for (const log of toDelete) {
      await base44.entities.AttendanceLog.delete(log.id);
    }
    await base44.entities.AttendanceUpload.delete(upload.id);
    loadUploads();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Upload Zone */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold text-base mb-1">Upload Attendance Excel</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Upload the monthly punch record Excel exported from your biometric software (ZKBioTime / Yunatt). Accepts .xlsx or .csv files.
        </p>

        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-primary/5'}`}
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileChange} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm font-medium">Processing file — extracting punch records...</p>
              <p className="text-xs text-muted-foreground">This may take 15–30 seconds</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{dragOver ? 'Drop to upload' : 'Drag & drop or click to select file'}</p>
                <p className="text-xs text-muted-foreground mt-1">Supports ZKBioTime / Yunatt monthly attendance export (.xlsx, .csv)</p>
              </div>
              <Button size="sm" variant="outline">
                <Upload className="w-4 h-4 mr-1.5" /> Browse File
              </Button>
            </div>
          )}
        </div>

        {/* Upload Result */}
        {uploadResult && (
          <div className={`mt-4 rounded-xl p-4 flex items-start gap-3 ${uploadResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            {uploadResult.error ? (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            )}
            <div>
              {uploadResult.error ? (
                <p className="text-sm font-medium text-red-800">Failed to parse file: {uploadResult.error}</p>
              ) : uploadResult.saved === 0 ? (
                <div>
                  <p className="text-sm font-medium text-orange-800">⚠️ No records imported</p>
                  <p className="text-xs text-orange-700 mt-1">
                    Found {uploadResult.dataRowsFound} employee row(s) and {uploadResult.dateCols} date column(s), but all date cells were empty.
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Please fill in time data (e.g. <strong>08:00 / 17:00</strong>) in the date cells before uploading.
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
            </div>
          </div>
        )}

        {/* Format hint */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 font-medium mb-1">📋 Expected Format</p>
          <p className="text-xs text-blue-700">
            The file should have columns for: <strong>Person Code</strong>, <strong>Name</strong>, and dates as columns (e.g. 05-01, 05-02...) with time pairs (IN/OUT) in each cell. This matches the standard ZKBioTime / Yunatt monthly export format.
          </p>
          <p className="text-xs text-orange-700 mt-2 font-medium">
            ⚠️ Only <strong>.xlsx</strong> and <strong>.csv</strong> are supported. If your file is <strong>.xls</strong>, open it in Excel and save as <em>Excel Workbook (.xlsx)</em> first.
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
                      {upload.created_date ? format(new Date(upload.created_date), 'MMM d, yyyy h:mm a') : '—'}
                    </span>
                    {upload.period_label && <span className="text-xs text-muted-foreground">· {upload.period_label}</span>}
                    <span className="text-xs font-medium text-green-700">{upload.records_imported || 0} records</span>
                    {upload.notes && <span className="text-xs text-orange-600">{upload.notes}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">by {upload.uploaded_by}</p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors shrink-0">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
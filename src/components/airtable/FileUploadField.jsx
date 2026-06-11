import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Download, Eye, Loader2, Upload, X } from 'lucide-react';

// Editable file field for re-hosted documents (Contract Files / ATD Files).
// Shows existing files with view/download/remove, and lets the user drag-drop
// or browse to add multiple new files. Value is an array of { filename, file_uri, type }.
export default function FileUploadField({ value, onChange }) {
  const files = Array.isArray(value) ? value : [];
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(null); // `${uri}:${mode}`
  const [dragOver, setDragOver] = useState(false);

  const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.filename || '');

  const getSignedUrl = async (file) => {
    const res = await base44.functions.invoke('extractAirtableFiles', { action: 'signUrl', fileUri: file.file_uri });
    return res.data?.signedUrl;
  };

  const handleView = async (file) => {
    setBusy(`${file.file_uri}:view`);
    try {
      const url = await getSignedUrl(file);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } finally { setBusy(null); }
  };

  const handleDownload = async (file) => {
    setBusy(`${file.file_uri}:download`);
    try {
      const url = await getSignedUrl(file);
      if (url) {
        const a = document.createElement('a');
        a.href = url; a.download = file.filename || 'document';
        document.body.appendChild(a); a.click(); a.remove();
      }
    } finally { setBusy(null); }
  };

  const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFiles = async (fileList) => {
    const arr = Array.from(fileList || []);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const payload = await Promise.all(arr.map(async (f) => ({
        filename: f.name, type: f.type, dataUrl: await readAsDataUrl(f),
      })));
      const res = await base44.functions.invoke('extractAirtableFiles', { action: 'uploadFiles', files: payload });
      const stored = res.data?.files || [];
      if (stored.length) onChange([...files, ...stored]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = (idx) => onChange(files.filter((_, i) => i !== idx));

  return (
    <div className="mt-1 space-y-2">
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, i) => {
            const viewing = busy === `${file.file_uri}:view`;
            const downloading = busy === `${file.file_uri}:download`;
            return (
              <div key={i} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1.5">
                <FileText className={`w-3.5 h-3.5 shrink-0 ${isPdf(file) ? 'text-red-500' : 'text-muted-foreground'}`} />
                <span className="truncate flex-1 text-xs" title={file.filename}>{file.filename || `file ${i + 1}`}</span>
                <button type="button" onClick={() => handleView(file)} disabled={viewing}
                  className="p-0.5 rounded hover:bg-background text-muted-foreground hover:text-primary shrink-0" title="View">
                  {viewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={() => handleDownload(file)} disabled={downloading}
                  className="p-0.5 rounded hover:bg-background text-muted-foreground hover:text-primary shrink-0" title="Download">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={() => handleRemove(i)}
                  className="p-0.5 rounded hover:bg-background text-muted-foreground hover:text-red-600 shrink-0" title="Remove">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-3 py-4 cursor-pointer transition-colors
          ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-xs text-muted-foreground">Uploading…</span></>
        ) : (
          <><Upload className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Drag files here or click to upload</span></>
        )}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>
    </div>
  );
}
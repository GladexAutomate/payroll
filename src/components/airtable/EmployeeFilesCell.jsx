import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Download, Eye, Loader2 } from 'lucide-react';

// Renders a stored file list (array of { filename, file_uri, type }) with view + download.
// Files live in private storage, so each action fetches a fresh signed URL on demand.
export default function EmployeeFilesCell({ files }) {
  const [busy, setBusy] = useState(null); // `${uri}:${mode}`

  if (!Array.isArray(files) || files.length === 0) {
    return <span className="text-muted-foreground/40">—</span>;
  }

  const isPdf = (file) =>
    file.type === 'application/pdf' || /\.pdf$/i.test(file.filename || '');

  const getSignedUrl = async (file) => {
    const res = await base44.functions.invoke('extractAirtableFiles', {
      action: 'signUrl', fileUri: file.file_uri,
    });
    return res.data?.signedUrl;
  };

  // View: open in a new tab so the browser renders PDFs/images inline.
  const handleView = async (file) => {
    setBusy(`${file.file_uri}:view`);
    try {
      const url = await getSignedUrl(file);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setBusy(null);
    }
  };

  // Download: force a save via a temporary anchor with the download attribute.
  const handleDownload = async (file) => {
    setBusy(`${file.file_uri}:download`);
    try {
      const url = await getSignedUrl(file);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename || 'document';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {files.map((file, i) => {
        const viewing = busy === `${file.file_uri}:view`;
        const downloading = busy === `${file.file_uri}:download`;
        return (
          <div key={i} className="flex items-center gap-1.5">
            <button
              onClick={() => handleView(file)}
              disabled={viewing}
              className="flex items-center gap-1.5 text-primary hover:underline text-xs text-left min-w-0"
              title={`View ${file.filename}`}
            >
              {viewing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                : isPdf(file)
                  ? <FileText className="w-3.5 h-3.5 shrink-0 text-red-500" />
                  : <FileText className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate max-w-[150px]">{file.filename || `file ${i + 1}`}</span>
            </button>
            <button
              onClick={() => handleView(file)}
              disabled={viewing}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-primary shrink-0"
              title="View in browser"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleDownload(file)}
              disabled={downloading}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-primary shrink-0"
              title="Download"
            >
              {downloading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Download className="w-3 h-3" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
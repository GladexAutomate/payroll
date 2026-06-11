import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Download, Loader2 } from 'lucide-react';

// Renders a stored file list (array of { filename, file_uri }) with download buttons.
// Files live in private storage, so each download fetches a fresh signed URL.
export default function EmployeeFilesCell({ files }) {
  const [downloadingUri, setDownloadingUri] = useState(null);

  if (!Array.isArray(files) || files.length === 0) {
    return <span className="text-muted-foreground/40">—</span>;
  }

  const handleDownload = async (file) => {
    setDownloadingUri(file.file_uri);
    try {
      const res = await base44.functions.invoke('extractAirtableFiles', {
        action: 'signUrl', fileUri: file.file_uri,
      });
      const url = res.data?.signedUrl;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingUri(null);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {files.map((file, i) => (
        <button
          key={i}
          onClick={() => handleDownload(file)}
          disabled={downloadingUri === file.file_uri}
          className="flex items-center gap-1.5 text-primary hover:underline text-xs text-left"
          title={`Download ${file.filename}`}
        >
          {downloadingUri === file.file_uri
            ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            : <FileText className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate max-w-[160px]">{file.filename || `file ${i + 1}`}</span>
          <Download className="w-3 h-3 shrink-0 opacity-50" />
        </button>
      ))}
    </div>
  );
}
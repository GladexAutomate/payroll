import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FolderDown, Loader2 } from 'lucide-react';

// Pulls CONTRACT + ATD DOCUMENTS attachments from Airtable, re-hosts them in
// Base44, and stores them on each mirror record — driven batch-by-batch so each
// request stays short and reliable.
export default function ExtractFilesButton({ onDone }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setProgress({ current: 0, total: 0 });
    try {
      const prep = await base44.functions.invoke('extractAirtableFiles', { action: 'prepare' });
      const total = prep.data?.total || 0;
      setProgress({ current: 0, total });
      if (prep.data?.error) throw new Error(prep.data.error);

      let offset = 0;
      let stored = 0;
      while (true) {
        const res = await base44.functions.invoke('extractAirtableFiles', { action: 'processBatch', offset });
        const data = res.data || {};
        if (data.error) throw new Error(data.error);
        stored += data.batchStored || 0;
        setProgress({ current: data.processed || 0, total: data.total || total });
        if (data.done) { setResult({ stored, employees: data.total || total }); break; }
        offset = data.nextOffset ?? (offset + 15);
      }
      onDone?.();
    } catch (err) {
      setResult({ error: err?.response?.data?.error || err.message || 'Extraction failed' });
    }
    setRunning(false);
  };

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={run} disabled={running}>
        {running ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FolderDown className="w-4 h-4 mr-1.5" />}
        {running ? 'Extracting Files…' : 'Extract Files from Airtable'}
      </Button>
      {running && progress.total > 0 && (
        <span className="text-xs text-muted-foreground">
          {progress.current} / {progress.total} employees
        </span>
      )}
      {result && !running && (
        result.error
          ? <span className="text-xs text-red-600">{result.error}</span>
          : <span className="text-xs text-green-700">
              Stored {result.stored} files across {result.employees} employees.
            </span>
      )}
    </div>
  );
}
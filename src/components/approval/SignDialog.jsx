import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Loader2, PenLine } from 'lucide-react';
import SignaturePad from './SignaturePad';

// Converts a data URL to a File for upload.
async function dataUrlToFile(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], 'signature.png', { type: 'image/png' });
}

// Modal for signing a step. Reuses the user's saved signature when available,
// with the option to draw a new one (which then becomes their saved signature).
export default function SignDialog({ userId, onClose, onSign }) {
  const [savedUrl, setSavedUrl] = useState('');
  const [savedRecordId, setSavedRecordId] = useState('');
  const [drawNew, setDrawNew] = useState(false);
  const [drawn, setDrawn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const recs = await base44.entities.UserSignature.filter({ created_by_id: userId }, '-updated_date', 1);
        if (recs.length) { setSavedUrl(recs[0].signature_url); setSavedRecordId(recs[0].id); }
        else setDrawNew(true);
      } catch { setDrawNew(true); }
      setLoading(false);
    })();
  }, [userId]);

  const handleSign = async () => {
    setBusy(true);
    try {
      let signatureUrl = savedUrl;
      if (drawNew) {
        if (!drawn) { setBusy(false); return; }
        const file = await dataUrlToFile(drawn);
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        signatureUrl = file_url;
        // Save/update this user's reusable signature.
        if (savedRecordId) await base44.entities.UserSignature.update(savedRecordId, { signature_url: file_url });
        else await base44.entities.UserSignature.create({ signature_url: file_url });
      }
      await onSign(signatureUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2"><PenLine className="w-4 h-4" /> Sign Approval</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : drawNew ? (
            <>
              <SignaturePad onChange={setDrawn} />
              {savedUrl && (
                <button type="button" onClick={() => setDrawNew(false)} className="text-xs text-primary hover:underline">
                  ← Use my saved signature instead
                </button>
              )}
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-white p-3 flex items-center justify-center">
                <img src={savedUrl} alt="Saved signature" className="max-h-28 object-contain" />
              </div>
              <button type="button" onClick={() => setDrawNew(true)} className="text-xs text-primary hover:underline">
                Draw a new signature
              </button>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={handleSign} disabled={busy || (drawNew && !drawn)}>
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Sign &amp; Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
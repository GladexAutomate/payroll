import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function RejectReasonDialog({ count = 1, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    await onConfirm(reason.trim());
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Reject {count > 1 ? `${count} schedules` : 'schedule'}?</h3>
          <p className="text-xs text-slate-500 mt-0.5">Add a short reason so the leader knows what to fix.</p>
        </div>
        <div className="p-5">
          <Textarea
            placeholder="e.g. Two days have no opener assigned…"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="h-24"
          />
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={confirm} disabled={busy}>
            {busy ? 'Rejecting…' : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  );
}
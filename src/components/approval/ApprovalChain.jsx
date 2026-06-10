import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, PenLine, X as XIcon, Clock } from 'lucide-react';
import { buildSteps, canSignCurrentStep, nextStatus, currentStepKey, STEP_LABELS } from '@/lib/approvalChain';
import SignDialog from './SignDialog';

// Renders the 3-step signed approval chain and lets the eligible current user sign/reject.
// Props:
//  - record: the request record (has chain_status, approval_chain)
//  - requestorTier: hierarchy tier of the employee the request belongs to
//  - current: { tier, signerName, signerRole, userId } from useCurrentTier
//  - isOwnRecord: whether record belongs to the current user (for step 1)
//  - onUpdate(patch): persist chain changes (also syncs status / atd_status)
export default function ApprovalChain({ record, requestorTier, current, isOwnRecord, onUpdate }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const chainStatus = record.chain_status || 'awaiting_employee';
  const chain = record.approval_chain || [];
  const steps = buildSteps(requestorTier);

  const signed = (stepKey) => chain.find((c) => c.step === stepKey);
  const eligible = canSignCurrentStep({ chainStatus, requestorTier, userTier: current.tier, isOwnRecord });
  const done = chainStatus === 'fully_signed';
  const rejected = chainStatus === 'rejected';

  const applySign = async (signatureUrl) => {
    const stepKey = currentStepKey(chainStatus);
    const entry = {
      step: stepKey,
      required_tier: current.tier,
      signer_name: current.signerName,
      signer_role: current.signerRole,
      signature_url: signatureUrl,
      signed_at: new Date().toISOString(),
    };
    const newChain = [...chain.filter((c) => c.step !== stepKey), entry];
    const newStatus = nextStatus(chainStatus);
    await onUpdate({ approval_chain: newChain, chain_status: newStatus, fully_signed: newStatus === 'fully_signed' });
    setDialogOpen(false);
  };

  const handleReject = async () => {
    await onUpdate({ chain_status: 'rejected', rejected: true });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {steps.map((s, i) => {
          const sig = signed(s.step);
          const isCurrent = currentStepKey(chainStatus) === s.step && !done && !rejected;
          return (
            <div key={s.step} className="flex items-center gap-1.5">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border ${
                sig ? 'bg-green-50 border-green-200 text-green-700'
                : isCurrent ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-muted/40 border-border text-muted-foreground'}`}>
                {sig ? <Check className="w-3 h-3" /> : isCurrent ? <Clock className="w-3 h-3" /> : null}
                {s.label}
              </div>
              {i < steps.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
            </div>
          );
        })}
      </div>

      {/* Signature thumbnails */}
      {chain.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {chain.map((c) => (
            <div key={c.step} className="flex items-center gap-1.5">
              <img src={c.signature_url} alt={c.signer_name} className="h-8 w-auto object-contain border border-border rounded bg-white px-1" />
              <span className="text-[11px] text-muted-foreground">{c.signer_name}</span>
            </div>
          ))}
        </div>
      )}

      {rejected && <span className="text-xs font-medium text-red-600">Rejected</span>}
      {done && <span className="text-xs font-medium text-green-700">Fully signed</span>}

      {eligible && !done && !rejected && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <PenLine className="w-3.5 h-3.5 mr-1" /> Sign this step
          </Button>
          <Button size="sm" variant="outline" className="text-red-600" onClick={handleReject}>
            <XIcon className="w-3.5 h-3.5 mr-1" /> Reject
          </Button>
        </div>
      )}

      {dialogOpen && (
        <SignDialog userId={current.userId} onClose={() => setDialogOpen(false)} onSign={applySign} />
      )}
    </div>
  );
}
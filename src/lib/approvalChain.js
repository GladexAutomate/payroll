// Shared logic for the 3-step signed approval chain:
//   Step 1: the request's own employee (filer) signs
//   Step 2: "mid" approver — depends on the REQUESTOR's tier:
//             - employees  -> a Leader OR a Manager may sign
//             - leaders    -> a Manager must sign
//             - managers   -> a Manager must sign
//   Step 3: HR Admin always signs last
//
// chain_status flows: awaiting_employee -> awaiting_mid -> awaiting_hr -> fully_signed (or rejected)

export const STEP_LABELS = {
  awaiting_employee: 'Awaiting employee signature',
  awaiting_mid: 'Awaiting approver signature',
  awaiting_hr: 'Awaiting HR Admin signature',
  fully_signed: 'Fully signed',
  rejected: 'Rejected',
};

// Which tiers may sign the "mid" (step 2) for a given requestor tier.
export function midTiersForRequestor(requestorTier) {
  if (requestorTier === 'leaders') return ['managers'];
  if (requestorTier === 'managers') return ['managers'];
  // employees (and anything unrecognized) -> leaders or managers
  return ['leaders', 'managers'];
}

// The ordered list of steps for the chain.
export function buildSteps(requestorTier) {
  return [
    { step: 'employee', status: 'awaiting_employee', allowedTiers: null, label: 'Employee (filer)' },
    { step: 'mid', status: 'awaiting_mid', allowedTiers: midTiersForRequestor(requestorTier), label: 'Manager / Leader' },
    { step: 'hr', status: 'awaiting_hr', allowedTiers: ['hr'], label: 'HR Admin' },
  ];
}

// Can the current user (with userTier + whether this record is their own) sign the awaiting step?
export function canSignCurrentStep({ chainStatus, requestorTier, userTier, isOwnRecord }) {
  if (chainStatus === 'awaiting_employee') return !!isOwnRecord;
  if (chainStatus === 'awaiting_mid') return midTiersForRequestor(requestorTier).includes(userTier);
  if (chainStatus === 'awaiting_hr') return userTier === 'hr';
  return false;
}

// Next chain_status after signing the current one.
export function nextStatus(chainStatus) {
  if (chainStatus === 'awaiting_employee') return 'awaiting_mid';
  if (chainStatus === 'awaiting_mid') return 'awaiting_hr';
  if (chainStatus === 'awaiting_hr') return 'fully_signed';
  return chainStatus;
}

// The step key for the currently-awaiting status.
export function currentStepKey(chainStatus) {
  if (chainStatus === 'awaiting_employee') return 'employee';
  if (chainStatus === 'awaiting_mid') return 'mid';
  if (chainStatus === 'awaiting_hr') return 'hr';
  return null;
}
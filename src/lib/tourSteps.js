// Coached-tour step definitions. Each step highlights a real element on the live UI
// via a stable [data-tour="..."] selector, optionally navigating to `path` first.
// Keep selectors in sync with the data-tour attributes placed across the app.

export const tourSteps = [
  {
    id: 'welcome',
    group: 'Welcome',
    path: '/',
    selector: null, // centered modal, no spotlight
    title: 'Welcome to PaySync PH',
    body: 'This quick tour walks you through the core flow: Sync employees → Build schedules → Track attendance → Reconcile → Run payroll. You can exit anytime and relaunch from the Help button.',
  },
  {
    id: 'nav',
    group: 'Navigation',
    path: '/',
    selector: '[data-tour="sidebar-nav"]',
    title: 'Your navigation',
    body: 'Everything is grouped here by module — People, Organization, Scheduling, Payroll, and more. Click any item to jump to that page.',
    placement: 'right',
  },
  {
    id: 'employees',
    group: 'People & Org',
    path: '/employees',
    selector: '[data-tour="page-content"]',
    title: 'Employees',
    body: 'Your master employee list. Match employees to biometric IDs and Airtable records here so attendance and payroll line up correctly.',
    placement: 'top',
  },
  {
    id: 'attendance',
    group: 'Time & Attendance',
    path: '/attendance-upload',
    selector: '[data-tour="page-content"]',
    title: 'Upload attendance',
    body: 'Import biometric punches here. The system groups punches into daily logs with hours, lates, and overtime — the raw input for reconciliation.',
    placement: 'top',
  },
  {
    id: 'schedule',
    group: 'Scheduling',
    path: '/schedule-requests',
    selector: '[data-tour="page-content"]',
    title: 'Approve schedules',
    body: 'Team leaders submit schedule proposals; HR reviews and approves them here. Approved schedules feed the reconciliation engine.',
    placement: 'top',
  },
  {
    id: 'reconciliation',
    group: 'Payroll',
    path: '/reconciliation',
    selector: '[data-tour="reconcile-run"]',
    title: 'Reconcile a period',
    body: 'Pick a pay period and branch, then run reconciliation. It computes gross, deductions, lates, absences, and statutory contributions per employee.',
    placement: 'bottom',
  },
  {
    id: 'payroll',
    group: 'Payroll',
    path: '/payroll',
    selector: '[data-tour="page-content"]',
    title: 'Run payroll',
    body: 'Create a payroll run from a reconciled period, review totals, then approve and release. Approved runs are snapshotted for history.',
    placement: 'top',
  },
  {
    id: 'done',
    group: 'All set',
    path: '/',
    selector: null,
    title: "You're all set! 🎉",
    body: "That's the full flow. Relaunch this tour anytime from the Help button in the top bar.",
  },
];
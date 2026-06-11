// Per-page interactive coached tours. Each page has its own step list that
// highlights real elements on the LIVE page (spotlight + tooltip) and walks the
// user through what they can do. Steps stay on the current page (no navigation).
//
// Selectors are resolved at runtime; if a selector isn't found, the CoachedTour
// engine gracefully shows a centered tooltip instead of a spotlight.
//
// Common reusable anchors available on every page:
//   [data-tour="sidebar-nav"]  - the sidebar navigation
//   [data-tour="page-content"] - the main page content area

const sidebarStep = {
  id: 'sidebar',
  group: 'Navigation',
  selector: '[data-tour="sidebar-nav"]',
  title: 'Navigate the app',
  body: 'Use this sidebar to move between modules — People, Organization, Scheduling, Payroll, Compliance, and more.',
  placement: 'right',
};

// Helper to build a simple page tour: an intro spotlight on the page content,
// optional extra steps, and always the sidebar nav step.
function pageTour(id, group, title, body, extraSteps = []) {
  return [
    {
      id: `${id}-intro`,
      group,
      selector: '[data-tour="page-content"]',
      title,
      body,
      placement: 'top',
    },
    ...extraSteps,
    sidebarStep,
  ];
}

export const pageTours = {
  '/': pageTour(
    'dashboard',
    'Dashboard',
    'Your daily overview',
    'This dashboard summarizes your workforce today — totals for present, absent, and on-leave employees, pending approvals, the next payroll date, and an attendance breakdown. Check it each morning to see what needs attention.'
  ),

  '/employees': pageTour(
    'employees',
    'People',
    'Manage employees',
    'This is your master employee list. Search and filter by status, then use "Add Employee" to create one or "Match Airtable" to pair employees with their Airtable records so attendance and payroll line up. Click any row to expand its Airtable match.'
  ),

  '/airtable-employees': pageTour(
    'airtable-employees',
    'People',
    'Airtable employee directory',
    'Here you can view, search, and edit the raw employee records synced from Airtable. You can also add or rename columns. This is the source data that powers payroll and scheduling.'
  ),

  '/user-management': pageTour(
    'user-management',
    'People',
    'User accounts & access',
    'Control who can log in. Activate or deactivate employee access, review the auto-generated login accounts, and manage which role (Job Title) each person holds.'
  ),

  '/organization-setup': pageTour(
    'org-setup',
    'Organization',
    'Set up your structure',
    'Map your organization here: Companies → Branches → Departments → Roles → Teams, and assign employees into the right place. This is the best first stop when configuring the app.'
  ),

  '/companies': pageTour(
    'companies',
    'Organization',
    'Manage companies',
    'Create and edit the companies in your organization. Employees and payroll runs belong to a company.'
  ),

  '/branches': pageTour(
    'branches',
    'Organization',
    'Manage branches',
    'Add branches and link them to their parent company. Payroll runs and reconciliation can be scoped to a specific branch.'
  ),

  '/departments': pageTour(
    'departments',
    'Organization',
    'Manage departments',
    'Create departments under branches to group employees by function.'
  ),

  '/department-roles': pageTour(
    'department-roles',
    'Organization',
    'Department roles',
    'Define the specific roles employees hold inside each department.'
  ),

  '/teams': pageTour(
    'teams',
    'Organization',
    'Build teams',
    'Create teams, assign a leader, and add members. Team leaders can submit schedule proposals for their team.'
  ),

  '/attendance': pageTour(
    'attendance',
    'Time & Attendance',
    'Review attendance',
    'See daily attendance per employee — time-in/out, late minutes, undertime, and overtime. Filter by period to review a specific cutoff.'
  ),

  '/attendance-upload': pageTour(
    'attendance-upload',
    'Time & Attendance',
    'Upload attendance',
    'Import biometric/attendance files here. The system groups punches into daily logs with hours, lates, and overtime — the raw input for reconciliation and payroll.'
  ),

  '/shifts': pageTour(
    'shifts',
    'Scheduling',
    'Shift templates',
    'Define the shift cards (times, work-from-home, rest days) that you assign across schedules.'
  ),

  '/schedule-proposal': pageTour(
    'schedule-proposal',
    'Scheduling',
    'Propose a schedule',
    'Team leaders build a proposed schedule for a team and period using this step-by-step wizard, then submit it to HR for review.'
  ),

  '/schedule-requests': pageTour(
    'schedule-requests',
    'Scheduling',
    'Approve schedules',
    'HR reviews schedule proposals here. Approve or reject each one — approved proposals become the official schedule and feed reconciliation.'
  ),

  '/approved-schedule': pageTour(
    'approved-schedule',
    'Scheduling',
    'The approved schedule',
    'This is the official schedule grid. View and adjust shifts per employee and date. Every change is recorded in Schedule Change History.'
  ),

  '/schedule-change-history': pageTour(
    'schedule-change-history',
    'Scheduling',
    'Schedule audit trail',
    'See who changed which schedule, when, and the old vs. new values — a full audit trail of schedule edits.'
  ),

  '/schedule-links': pageTour(
    'schedule-links',
    'Scheduling',
    'Shareable schedule links',
    'Generate read-only links so employees can view their schedule without logging in.'
  ),

  '/leaves': pageTour(
    'leaves',
    'Scheduling',
    'Leave requests',
    'Review, approve, or reject leave applications through a signed approval chain. Paid leaves are factored into payroll automatically.'
  ),

  '/overtime': pageTour(
    'overtime',
    'Scheduling',
    'Overtime requests',
    'Approve overtime so it is paid — or banked so employees can use it later as an offset.'
  ),

  '/offsets': pageTour(
    'offsets',
    'Scheduling',
    'Offsets',
    'Approve offset requests where banked overtime covers shorter work hours. You can also review each employee\'s OT bank balance.'
  ),

  '/reconciliation': pageTour(
    'reconciliation',
    'Payroll',
    'Reconcile a period',
    'Pick a pay period and branch, then run reconciliation. It computes gross, deductions, lates, absences, and statutory contributions per employee — the numbers that feed the final payroll. Review and adjust results before running payroll.',
    [
      {
        id: 'reconcile-run',
        group: 'Payroll',
        selector: '[data-tour="reconcile-run"]',
        title: 'Run reconciliation',
        body: 'Set the period and branch here, then start the run. Progress is shown live while it processes each employee.',
        placement: 'bottom',
      },
    ]
  ),

  '/payroll': pageTour(
    'payroll',
    'Payroll',
    'Run payroll',
    'Create a payroll run from a reconciled period and branch, compute pay, place individual salaries on hold if needed, then approve and release. Approved runs are snapshotted to history and payslips can be generated.'
  ),

  '/deductions': pageTour(
    'deductions',
    'Payroll',
    'Allowances & charges',
    'Add allowances (extra pay) or charges like cash advances and uniforms. Charges follow an Authorization-To-Deduct (ATD) signed approval chain, and you set the amount per cutoff and how many cutoffs to spread them over.'
  ),

  '/tax-compliance': pageTour(
    'tax-compliance',
    'Compliance',
    'Tax compliance',
    'Generate government reports such as 1601-C and 2316 certificates, validate TINs, and review annual employee tax data.'
  ),

  '/reports': pageTour(
    'reports',
    'Insights',
    'Reports & analytics',
    'Review workforce, attendance, and payroll insights, and export reports from one place.'
  ),

  '/settings': pageTour(
    'settings',
    'Admin',
    'App settings',
    'Configure payroll rules, government contribution rates, and other app-wide settings here.'
  ),

  '/permissions': pageTour(
    'permissions',
    'Admin',
    'Page permissions',
    'Control which pages each role can access, tailoring what every user sees. (Admin only)'
  ),

  '/role-hierarchy': pageTour(
    'role-hierarchy',
    'Admin',
    'Role hierarchy',
    'Map each role to a tier (Managers, Leaders, Employees). Tiers drive the signed approval chains for leaves, overtime, and deductions. (Admin only)'
  ),
};

// Resolve the tour for the current pathname, with a sensible generic fallback.
export function getPageTour(pathname) {
  if (pageTours[pathname]) return pageTours[pathname];
  return pageTour(
    'generic',
    'Guide',
    'About this page',
    'Use the sidebar to navigate between modules. Open the Guide on any page to see an interactive walkthrough of what you can do there.'
  );
}
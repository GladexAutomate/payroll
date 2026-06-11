// Per-page interactive coached tours. Each page has its own multi-step list that
// highlights real elements on the LIVE page (spotlight + tooltip) and walks the
// user through how to use ALL of that page's features. Steps stay on the current
// page (no navigation).
//
// Selectors are resolved at runtime; if a selector isn't found, the CoachedTour
// engine gracefully shows a centered tooltip instead of a spotlight.
//
// Anchors available on EVERY page:
//   [data-tour="sidebar-nav"]  - the sidebar navigation
//   [data-tour="page-content"] - the main page content area
// Pages may expose additional element-level anchors (e.g. emp-add) for richer steps.

// Builds a page tour from a list of steps.
function tour(steps) {
  return [...steps];
}

// A single "page intro" step spotlighting the whole content area.
function intro(id, group, title, body) {
  return { id: `${id}-intro`, group, selector: '[data-tour="page-content"]', title, body, placement: 'top' };
}

export const pageTours = {
  '/': tour([
    intro('dashboard', 'Dashboard', 'Your daily overview',
      'The dashboard is your morning command center. Each card summarizes the workforce right now so you can spot what needs attention before doing anything else.'),
    { id: 'dash-stats', group: 'Dashboard', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Headline numbers',
      body: 'The top stat cards show totals for present, absent, and on-leave employees, the count of pending approvals, and your next payroll date. Numbers refresh from live attendance data.' },
    { id: 'dash-breakdown', group: 'Dashboard', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Attendance breakdown',
      body: 'The charts break attendance down so you can see trends and outliers. Use them to decide whether to chase missing punches or follow up on absences.' },
  ]),

  '/employees': tour([
    intro('employees', 'People', 'Your employee master list',
      'This page is the master list of employees used across attendance, scheduling, and payroll. Each row shows the person, their Airtable match, status, and employee number.'),
    { id: 'emp-search', group: 'People', selector: '[data-tour="emp-toolbar"]', placement: 'bottom',
      title: 'Search & filter',
      body: 'Type a name, employee number, or position to find someone fast. Use the status dropdown to show only Active, Inactive, or "No Match" employees — great for cleaning up unmatched records.' },
    { id: 'emp-match', group: 'People', selector: '[data-tour="emp-match"]', placement: 'bottom',
      title: 'Match to Airtable',
      body: '"Match Airtable" automatically pairs each employee with their Airtable record by name. Matching is what links biometric punches and payroll figures to the right person — run it after adding employees.' },
    { id: 'emp-add', group: 'People', selector: '[data-tour="emp-add"]', placement: 'bottom',
      title: 'Add an employee',
      body: 'Click "Add Employee" to create a new record with their name, employee number, position, and department. You can edit the same fields later from the form.' },
    { id: 'emp-table', group: 'People', selector: '[data-tour="emp-table"]', placement: 'top',
      title: 'The employee table',
      body: 'The Airtable Match column shows or lets you fix each link. The Status column reflects the Airtable status (Active/Inactive), and Employee No. is the biometric ID used to read attendance.' },
  ]),

  '/airtable-employees': tour([
    intro('airtable-employees', 'People', 'Airtable employee directory',
      'This grid shows the raw employee records synced from Airtable — the source data that powers payroll, scheduling, and the organization structure.'),
    { id: 'ae-search', group: 'People', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Search & refresh',
      body: 'Search across every field with the search box, and use Refresh to re-pull the latest records. Records are paginated — scroll to load more.' },
    { id: 'ae-sort', group: 'People', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Sort & filter columns',
      body: 'Each column header has sort and per-column Filter controls so you can narrow the list (e.g. only one company or branch).' },
    { id: 'ae-edit', group: 'People', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Edit records & columns',
      body: 'Use the pencil icon on a row to edit that employee\'s fields, or the trash icon to remove them. You can also add new columns or rename existing ones to extend the directory.' },
  ]),

  '/user-management': tour([
    intro('user-management', 'People', 'User accounts & access',
      'Control who can log into the app and what role they hold. Accounts are generated automatically from employee records.'),
    { id: 'um-activate', group: 'People', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Activate / deactivate access',
      body: 'Toggle an employee\'s login access on or off. Deactivated users can no longer sign in. Each account also shows its auto-generated login credentials.' },
    { id: 'um-role', group: 'People', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Roles drive permissions',
      body: 'A user\'s role (their Job Title) determines which pages they can see, configured under Admin → Permissions and Role Hierarchy.' },
  ]),

  '/organization-setup': tour([
    intro('org-setup', 'Organization', 'Set up your structure',
      'This is the best first stop when configuring the app. Map your full hierarchy here: Companies → Branches → Departments → Roles → Teams.'),
    { id: 'os-columns', group: 'Organization', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Drill down the hierarchy',
      body: 'Pick a company to reveal its branches, then a branch to reveal departments and roles. Selecting any level filters everything to the right.' },
    { id: 'os-assign', group: 'Organization', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Assign & reassign employees',
      body: 'View who belongs to each group and move employees between companies, branches, departments, roles, or teams. This keeps payroll and scheduling scoped correctly.' },
  ]),

  '/companies': tour([
    intro('companies', 'Organization', 'Manage companies',
      'Create and edit the companies in your organization. Employees and payroll runs belong to a company, so set these up first.'),
    { id: 'co-add', group: 'Organization', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Add & edit companies',
      body: 'Use the add button to create a company, and the row actions to rename or update an existing one. Branches are then linked under each company.' },
  ]),

  '/branches': tour([
    intro('branches', 'Organization', 'Manage branches',
      'Branches sit under companies. Payroll runs and reconciliation can be scoped to a single branch.'),
    { id: 'br-add', group: 'Organization', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Add a branch',
      body: 'Create a branch and link it to its parent company. You can also set its location, then assign employees and departments to it.' },
  ]),

  '/departments': tour([
    intro('departments', 'Organization', 'Manage departments',
      'Departments group employees by function within a branch.'),
    { id: 'dept-add', group: 'Organization', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Create departments',
      body: 'Add departments under the relevant branch, then create roles inside each department to describe what people do.' },
  ]),

  '/department-roles': tour([
    intro('department-roles', 'Organization', 'Department roles',
      'Roles define the specific positions employees hold inside each department.'),
    { id: 'dr-add', group: 'Organization', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Add roles',
      body: 'Create and edit the roles available in each department. Employees are assigned a role during organization setup.' },
  ]),

  '/teams': tour([
    intro('teams', 'Organization', 'Build teams',
      'Teams let a leader manage a group of employees and submit schedule proposals on their behalf.'),
    { id: 'tm-create', group: 'Organization', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Create a team',
      body: 'Add a team, assign a leader (with their email), and add members. The leader can then build schedule proposals for this team.' },
    { id: 'tm-leader', group: 'Organization', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Leaders & approvals',
      body: 'The leader you set here is who submits schedules and signs the first step of approval chains for leaves, overtime, and offsets.' },
  ]),

  '/attendance': tour([
    intro('attendance', 'Time & Attendance', 'Review attendance',
      'See daily attendance per employee — time in/out, late minutes, undertime, and overtime — for any pay period.'),
    { id: 'att-period', group: 'Time & Attendance', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Pick a period',
      body: 'Use the period selector to review a specific cutoff. The view recomputes totals for everyone in that range.' },
    { id: 'att-rows', group: 'Time & Attendance', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Per-employee detail',
      body: 'Each row shows the day\'s punches and derived figures (lates, undertime, OT). This is the raw input that reconciliation turns into pay.' },
  ]),

  '/attendance-upload': tour([
    intro('attendance-upload', 'Time & Attendance', 'Upload attendance',
      'Import biometric / attendance files here. The system groups punches into daily logs with hours, lates, and overtime.'),
    { id: 'au-upload', group: 'Time & Attendance', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Upload a file',
      body: 'Drop or select your attendance export. The importer reads punches, matches them to employees by biometric ID, and builds daily attendance logs.' },
    { id: 'au-review', group: 'Time & Attendance', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Review & new employees',
      body: 'After import, review the processed logs and any unrecognized employees so you can match them before reconciling and running payroll.' },
  ]),

  '/shifts': tour([
    intro('shifts', 'Scheduling', 'Shift templates',
      'Shift templates are the reusable cards (start/end times, work-from-home, rest days) you assign across schedules.'),
    { id: 'sh-add', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Create shift cards',
      body: 'Define each shift\'s times and type. These cards then appear as options when plotting schedules in proposals and the approved schedule grid.' },
  ]),

  '/schedule-proposal': tour([
    intro('schedule-proposal', 'Scheduling', 'Propose a schedule',
      'Team leaders build a proposed schedule for a team and period, then submit it to HR for review.'),
    { id: 'sp-wizard', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Step-by-step wizard',
      body: 'Pick the team and period, then plot each employee\'s shifts day by day using your shift templates. The wizard guides you through each step.' },
    { id: 'sp-submit', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Submit for review',
      body: 'When finished, submit the proposal. It appears in Schedule Requests for HR to approve or reject.' },
  ]),

  '/schedule-requests': tour([
    intro('schedule-requests', 'Scheduling', 'Approve schedules',
      'HR reviews every submitted schedule proposal here, grouped by company and branch.'),
    { id: 'sr-filter', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Filter & search',
      body: 'Use the toolbar to search and filter by status (pending, approved, rejected) so you can focus on what still needs a decision.' },
    { id: 'sr-actions', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Approve or reject',
      body: 'Approve a proposal to make it the official schedule (it feeds reconciliation), or reject it with a reason. You can also act on several at once with bulk actions.' },
  ]),

  '/approved-schedule': tour([
    intro('approved-schedule', 'Scheduling', 'The approved schedule',
      'This grid is the official schedule. View and adjust shifts per employee and date, with leaves and actual attendance overlaid.'),
    { id: 'as-filter', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Scope & period',
      body: 'Filter by branch, department, role, or team and choose the pay period. The legend explains each colour and overlay on the grid.' },
    { id: 'as-edit', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Edit shifts',
      body: 'Click a cell to change an employee\'s shift for that day. Every change is recorded in Schedule Change History for a full audit trail.' },
    { id: 'as-export', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Reconcile & export',
      body: 'Use the reconcile controls to align the schedule with actual attendance, and export the final schedule to Excel when you need to share it.' },
  ]),

  '/schedule-change-history': tour([
    intro('sch-history', 'Scheduling', 'Schedule audit trail',
      'A searchable log of every schedule edit — who changed it, when, and the old vs. new shift.'),
    { id: 'sch-search', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Search the log',
      body: 'Filter by employee name, the editor, or date to trace exactly how a schedule changed and by whom.' },
  ]),

  '/schedule-links': tour([
    intro('schedule-links', 'Scheduling', 'Shareable schedule links',
      'Generate read-only links so employees can view their schedule without logging in.'),
    { id: 'sl-create', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Create & share links',
      body: 'Create a link scoped to a branch, department, role, or team, then copy and share it. Anyone with the link sees a live, read-only schedule view.' },
  ]),

  '/leaves': tour([
    intro('leaves', 'Scheduling', 'Leave requests',
      'Review, approve, or reject leave applications. Paid leaves are factored into payroll automatically.'),
    { id: 'lv-chain', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Signed approval chain',
      body: 'Each leave moves through a signed approval chain (employee → mid-level → HR). You sign your step to advance it, or reject with a reason.' },
    { id: 'lv-paid', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Paid vs. unpaid',
      body: 'Mark whether a leave is paid. Paid leave days are counted in reconciliation so the employee is compensated correctly.' },
  ]),

  '/overtime': tour([
    intro('overtime', 'Scheduling', 'Overtime requests',
      'Approve overtime so it is paid — or bank it so employees can use it later as an offset.'),
    { id: 'ot-decision', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Pay or bank',
      body: 'When you approve overtime you decide whether it is paid out this cutoff or banked. Banked hours show up as an OT balance the employee can offset against.' },
  ]),

  '/offsets': tour([
    intro('offsets', 'Scheduling', 'Offsets',
      'Offsets let employees use banked overtime to cover shorter work hours while still being paid in full.'),
    { id: 'of-approve', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Approve offsets',
      body: 'Review each offset request and approve or reject it. The hours used are drawn from the employee\'s banked OT.' },
    { id: 'of-bank', group: 'Scheduling', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Check OT balances',
      body: 'The OT bank table shows how many banked hours each employee has left, so you can confirm they have enough before approving.' },
  ]),

  '/reconciliation': tour([
    intro('reconciliation', 'Payroll', 'Reconcile a period',
      'Reconciliation computes the numbers that feed payroll: gross, deductions, lates, absences, statutory contributions, and net per employee.'),
    { id: 'reconcile-run', group: 'Payroll', selector: '[data-tour="reconcile-run"]', placement: 'bottom',
      title: 'Run a reconciliation',
      body: 'Set the pay period and branch, then start the run. Progress is shown live as it processes each employee using attendance, leaves, overtime, and charges.' },
    { id: 'reconcile-history', group: 'Payroll', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Review past runs',
      body: 'The history table lists previous runs. Open one to inspect each employee\'s computed pay and make manual adjustments before you run payroll.' },
  ]),

  '/payroll': tour([
    intro('payroll', 'Payroll', 'Run payroll',
      'Turn a reconciled period into an official payroll run, then approve and release it.'),
    { id: 'pr-create', group: 'Payroll', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Create a run',
      body: 'Start a new payroll run from a reconciled period and branch, set the pay date, then compute pay. Progress is tracked while it processes.' },
    { id: 'pr-hold', group: 'Payroll', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Hold, approve, release',
      body: 'Place individual salaries on hold to exclude them from totals, then approve and release the run. Approved runs are snapshotted to history.' },
    { id: 'pr-payslip', group: 'Payroll', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Payslips',
      body: 'Open a run to view per-employee detail and generate payslip documents.' },
  ]),

  '/deductions': tour([
    intro('deductions', 'Payroll', 'Allowances & charges',
      'Add recurring allowances (extra pay) or charges like cash advances and uniforms that are deducted over time.'),
    { id: 'dd-add', group: 'Payroll', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Create an allowance or charge',
      body: 'Choose allowance or charge, set the amount per cutoff, and for charges set the total and how many cutoffs to spread it over. You can scope it to a company or branch.' },
    { id: 'dd-atd', group: 'Payroll', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Authorization-To-Deduct',
      body: 'Charges follow a signed ATD approval chain and only become active once fully signed — this protects employees from unapproved deductions.' },
    { id: 'dd-gov', group: 'Payroll', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Government settings',
      body: 'You can also manage each employee\'s statutory government contribution settings here.' },
  ]),

  '/tax-compliance': tour([
    intro('tax-compliance', 'Compliance', 'Tax compliance',
      'Generate government reports, validate TINs, and review annual employee tax data from one place.'),
    { id: 'tc-reports', group: 'Compliance', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Statutory reports',
      body: 'Produce reports such as 1601-C and 2316 certificates, and an annual overview, filtered by company, branch, and period.' },
    { id: 'tc-tin', group: 'Compliance', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Validate TINs',
      body: 'Run TIN validation to catch missing or malformed tax IDs before you file.' },
  ]),

  '/reports': tour([
    intro('reports', 'Insights', 'Reports & analytics',
      'Review workforce, attendance, and payroll insights, and export reports for sharing.'),
    { id: 'rp-export', group: 'Insights', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Filter & export',
      body: 'Use the filters to focus a report, then export the data you need.' },
  ]),

  '/settings': tour([
    intro('settings', 'Admin', 'App settings',
      'Configure how payroll behaves across the whole app.'),
    { id: 'st-rules', group: 'Admin', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Payroll rules',
      body: 'Set payroll computation rules — how lates, undertime, overtime, and absences affect pay.' },
    { id: 'st-stat', group: 'Admin', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Statutory rates',
      body: 'Maintain the SSS, PhilHealth, Pag-IBIG, and withholding tax settings used in reconciliation and payroll.' },
  ]),

  '/permissions': tour([
    intro('permissions', 'Admin', 'Page permissions',
      'Control exactly which pages each role can access. (Admin only)'),
    { id: 'pm-role', group: 'Admin', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Grant page access',
      body: 'Pick a role, then tick the pages it should see. Non-selected pages are hidden from that role\'s sidebar entirely.' },
  ]),

  '/role-hierarchy': tour([
    intro('role-hierarchy', 'Admin', 'Role hierarchy',
      'Map each role to a tier — Managers, Leaders, or Employees. (Admin only)'),
    { id: 'rh-tier', group: 'Admin', selector: '[data-tour="page-content"]', placement: 'top',
      title: 'Tiers drive approvals',
      body: 'Tiers determine who signs which step of the approval chains for leaves, overtime, and deductions. Assign every role to the correct tier here.' },
  ]),
};

// Resolve the tour for the current pathname, with a sensible generic fallback so
// EVERY page always has a working Guide.
export function getPageTour(pathname) {
  if (pageTours[pathname]) return pageTours[pathname];
  return tour([
    intro('generic', 'Guide', 'About this page',
      'Explore this page using the controls in the content area. Open the Guide on any page for an interactive walkthrough of its features, and use the sidebar to move between modules.'),
  ]);
}
// Deep help / user guide content describing every page in the app.
// Grouped to mirror the sidebar navigation. Used by the Help Center panel.

export const helpGuideGroups = [
  {
    group: 'Dashboard',
    pages: [
      {
        title: 'Dashboard',
        path: '/',
        summary: 'Your daily workforce overview at a glance.',
        details: [
          'Shows total active employees, who is present, absent, or on leave today.',
          'Highlights pending leave & overtime requests awaiting your approval.',
          'Displays the next payroll due date and a breakdown of today\'s attendance.',
          'Use this as your starting point each morning to spot what needs attention.',
        ],
      },
    ],
  },
  {
    group: 'People',
    pages: [
      {
        title: 'Employees',
        path: '/employees',
        summary: 'The master list of all your employees.',
        details: [
          'Search, filter by status (Active/Inactive), and add new employees.',
          'Each row links an employee to their matching Airtable record.',
          'Use "Match Airtable" to automatically pair employees with Airtable data.',
          'Shows status and employee number for quick reference.',
        ],
      },
      {
        title: 'Airtable Employee List',
        path: '/airtable-employees',
        summary: 'The full Airtable-synced employee directory.',
        details: [
          'View, search, and edit the raw employee records synced from Airtable.',
          'Add or rename columns to manage extra employee details.',
          'This is the source data that powers payroll and scheduling.',
        ],
      },
      {
        title: 'User Management',
        path: '/user-management',
        summary: 'Control who can log in and what role they have.',
        details: [
          'See login accounts generated for employees and their access status.',
          'Activate or deactivate employee access to the system.',
          'Manage which Job Title (role) each person is assigned.',
        ],
      },
    ],
  },
  {
    group: 'Organization',
    pages: [
      {
        title: 'Organization Setup',
        path: '/organization-setup',
        summary: 'Map your company structure in one guided place.',
        details: [
          'Set up the hierarchy: Companies → Branches → Departments → Roles → Teams.',
          'Assign employees to the right part of the organization.',
          'A great first stop when configuring the app.',
        ],
      },
      {
        title: 'Companies',
        path: '/companies',
        summary: 'Manage the companies in your organization.',
        details: ['Create and edit companies that employees and payroll belong to.'],
      },
      {
        title: 'Branches',
        path: '/branches',
        summary: 'Manage branches under each company.',
        details: [
          'Add branches and link them to their parent company.',
          'Payroll runs can be scoped to a specific branch.',
        ],
      },
      {
        title: 'Departments',
        path: '/departments',
        summary: 'Organize employees into departments.',
        details: ['Create departments under branches to group employees by function.'],
      },
      {
        title: 'Department Roles',
        path: '/department-roles',
        summary: 'Define roles within each department.',
        details: ['Set up the specific roles employees hold inside a department.'],
      },
      {
        title: 'Teams',
        path: '/teams',
        summary: 'Group employees into teams with a leader.',
        details: [
          'Create teams, assign a leader, and add members.',
          'Team leaders can submit schedule proposals for their team.',
        ],
      },
    ],
  },
  {
    group: 'Time & Attendance',
    pages: [
      {
        title: 'Attendance',
        path: '/attendance',
        summary: 'Review daily attendance records for employees.',
        details: [
          'See time-in/time-out, late minutes, undertime, and overtime per day.',
          'Filter by period to review attendance for a specific cutoff.',
        ],
      },
      {
        title: 'Upload Attendance',
        path: '/attendance-upload',
        summary: 'Import attendance data from biometric files.',
        details: [
          'Upload exported biometric/attendance files to bring punches into the system.',
          'Processed punches become attendance logs used in reconciliation and payroll.',
        ],
      },
    ],
  },
  {
    group: 'Scheduling',
    pages: [
      {
        title: 'Shift Schedules',
        path: '/shifts',
        summary: 'Define the shift templates employees can be assigned.',
        details: ['Create shift cards (times, WFH, rest days) used across schedules.'],
      },
      {
        title: 'Schedule Proposal',
        path: '/schedule-proposal',
        summary: 'Team leaders propose schedules for HR review.',
        details: [
          'Build a proposed schedule for a team and period, then submit for approval.',
          'Step-by-step wizard guides you through assigning shifts.',
        ],
      },
      {
        title: 'Schedule Requests',
        path: '/schedule-requests',
        summary: 'HR reviews and approves submitted schedule proposals.',
        details: [
          'Approve or reject schedule proposals from team leaders.',
          'Approved proposals become the official schedule.',
        ],
      },
      {
        title: 'Approved Schedule',
        path: '/approved-schedule',
        summary: 'The official, locked-in schedule grid.',
        details: [
          'View and adjust the approved schedule for each employee and date.',
          'Changes here are tracked in Schedule Change History.',
        ],
      },
      {
        title: 'Schedule Change History',
        path: '/schedule-change-history',
        summary: 'Audit trail of every schedule edit.',
        details: ['See who changed which schedule, when, and what the old/new values were.'],
      },
      {
        title: 'Schedule Links',
        path: '/schedule-links',
        summary: 'Shareable, read-only schedule links.',
        details: ['Generate links so employees can view their schedule without logging in.'],
      },
      {
        title: 'Leave Requests',
        path: '/leaves',
        summary: 'Manage employee leave applications.',
        details: [
          'Review, approve, or reject leave requests through a signed approval chain.',
          'Paid leaves are factored into payroll automatically.',
        ],
      },
      {
        title: 'Overtime',
        path: '/overtime',
        summary: 'Manage overtime requests.',
        details: ['Approve overtime so it is paid (or banked for offsets).'],
      },
      {
        title: 'Offsets',
        path: '/offsets',
        summary: 'Let employees use banked overtime as time off.',
        details: [
          'Approve offset requests where banked OT covers shorter work hours.',
          'View the OT bank balance per employee.',
        ],
      },
    ],
  },
  {
    group: 'Payroll',
    pages: [
      {
        title: 'Reconciliation',
        path: '/reconciliation',
        summary: 'Compute attendance-based pay before running payroll.',
        details: [
          'Select a period and branch, then run reconciliation to compute gross, deductions, and net per employee.',
          'Review and manually adjust results where needed.',
          'This prepares the numbers that feed into the final payroll.',
        ],
      },
      {
        title: 'Payroll',
        path: '/payroll',
        summary: 'Create, compute, approve, and release payroll runs.',
        details: [
          'Generate a payroll run for a period and branch.',
          'Compute pay, place individual salaries on hold if needed, then approve.',
          'Approved runs are snapshotted to history and payslips can be generated.',
        ],
      },
      {
        title: 'Allowances & Charges',
        path: '/deductions',
        summary: 'Manage recurring allowances and ATD deductions.',
        details: [
          'Add allowances (extra pay) or charges like cash advances and uniforms.',
          'Charges follow an Authorization-To-Deduct (ATD) signed approval chain.',
          'Set amounts per cutoff and how many cutoffs to spread them over.',
        ],
      },
    ],
  },
  {
    group: 'Compliance',
    pages: [
      {
        title: 'Tax Compliance',
        path: '/tax-compliance',
        summary: 'Government reports and tax compliance tools.',
        details: [
          'Generate reports like 1601-C and 2316 certificates.',
          'Validate TINs and review annual employee tax data.',
        ],
      },
    ],
  },
  {
    group: 'Insights',
    pages: [
      {
        title: 'Reports',
        path: '/reports',
        summary: 'Analytics and exportable reports.',
        details: ['Review workforce, attendance, and payroll insights in one place.'],
      },
    ],
  },
  {
    group: 'Admin',
    pages: [
      {
        title: 'Settings',
        path: '/settings',
        summary: 'Configure payroll rules and statutory contributions.',
        details: [
          'Set payroll rules, government contribution rates, and other app-wide settings.',
        ],
      },
      {
        title: 'Permissions',
        path: '/permissions',
        summary: 'Control which pages each role can access. (Admin only)',
        details: ['Assign allowed pages per role to tailor what each user sees.'],
      },
      {
        title: 'Role Hierarchy',
        path: '/role-hierarchy',
        summary: 'Define approval tiers for roles. (Admin only)',
        details: [
          'Map each role to a tier (Managers, Leaders, Employees).',
          'Tiers drive the signed approval chains for leaves, OT, and deductions.',
        ],
      },
    ],
  },
];
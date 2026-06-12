import {
  LayoutDashboard, Users, Clock, CalendarDays, DollarSign,
  FileText, Settings, Building2, ClipboardList, Calendar, Upload,
  Database, ClipboardCheck, Send, ShieldCheck, CalendarCheck, Repeat,
  Receipt, Link2, Scale, KeyRound, Network, History, Gift,
} from 'lucide-react';

// Single source of truth for all navigable pages, grouped for the sidebar
// and the permissions editor. The Permissions page itself is admin-only and
// intentionally NOT listed here (it can never be granted to a non-admin role).
export const navGroups = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [{ label: 'Dashboard', icon: LayoutDashboard, path: '/' }],
  },
  {
    label: 'People',
    icon: Users,
    items: [
      { label: 'Employees', icon: Users, path: '/employees' },
      { label: 'Airtable Employee List', icon: Database, path: '/airtable-employees' },
      { label: 'User Management', icon: ShieldCheck, path: '/user-management' },
    ],
  },
  {
    label: 'Organization',
    icon: Building2,
    items: [
      { label: 'Organization Setup', icon: Building2, path: '/organization-setup' },
      { label: 'Companies', icon: Building2, path: '/companies' },
      { label: 'Branches', icon: Building2, path: '/branches' },
      { label: 'Departments', icon: Building2, path: '/departments' },
      { label: 'Department Roles', icon: Building2, path: '/department-roles' },
      { label: 'Teams', icon: Users, path: '/teams' },
    ],
  },
  {
    label: 'Time & Attendance',
    icon: Clock,
    items: [
      { label: 'Attendance', icon: Clock, path: '/attendance' },
      { label: 'Upload Attendance', icon: Upload, path: '/attendance-upload' },
    ],
  },
  {
    label: 'Scheduling',
    icon: CalendarDays,
    items: [
      { label: 'Shift Schedules', icon: CalendarDays, path: '/shifts' },
      { label: 'Schedule Proposal', icon: Send, path: '/schedule-proposal' },
      { label: 'Schedule Requests', icon: ClipboardCheck, path: '/schedule-requests' },
      { label: 'Approved Schedule', icon: CalendarCheck, path: '/approved-schedule' },
      { label: 'Schedule Change History', icon: History, path: '/schedule-change-history' },
      { label: 'Schedule Links', icon: Link2, path: '/schedule-links' },
      { label: 'Leave Requests', icon: Calendar, path: '/leaves' },
      { label: 'Overtime', icon: ClipboardList, path: '/overtime' },
      { label: 'Offsets', icon: Repeat, path: '/offsets' },
    ],
  },
  {
    label: 'Payroll',
    icon: DollarSign,
    items: [
      { label: 'Reconciliation', icon: ClipboardCheck, path: '/reconciliation' },
      { label: 'Payroll', icon: DollarSign, path: '/payroll' },
      { label: 'Payroll Approval Hierarchy', icon: Network, path: '/payroll-approval-hierarchy', adminOnly: true },
      { label: 'Allowances & Charges', icon: Receipt, path: '/deductions' },
    ],
  },
  {
    label: 'Compliance',
    icon: Scale,
    items: [
      { label: 'Tax Compliance', icon: ShieldCheck, path: '/tax-compliance' },
      { label: '13th Month Pay', icon: Gift, path: '/thirteenth-month' },
    ],
  },
  {
    label: 'Insights',
    icon: FileText,
    items: [{ label: 'Reports', icon: FileText, path: '/reports' }],
  },
  {
    label: 'Admin',
    icon: Settings,
    items: [
      { label: 'Settings', icon: Settings, path: '/settings' },
      { label: 'Permissions', icon: KeyRound, path: '/permissions', adminOnly: true },
      { label: 'Role Hierarchy', icon: Network, path: '/role-hierarchy', adminOnly: true },
    ],
  },
];

// Every assignable page path (excludes adminOnly pages like /permissions).
export const allAssignablePaths = navGroups
  .flatMap((group) => group.items)
  .filter((item) => !item.adminOnly)
  .map((item) => item.path);
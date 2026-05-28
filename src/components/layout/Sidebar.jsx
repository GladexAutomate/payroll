import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Clock, CalendarDays, DollarSign,
  FileText, Settings, ChevronRight, Building2, Fingerprint,
  ClipboardList, Calendar, Upload, X, Database, ClipboardCheck, Send, ShieldCheck
} from 'lucide-react';

const navGroups = [
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
      { label: 'Leave Requests', icon: Calendar, path: '/leaves' },
      { label: 'Overtime', icon: ClipboardList, path: '/overtime' },
    ],
  },
  {
    label: 'Payroll',
    icon: DollarSign,
    items: [{ label: 'Payroll', icon: DollarSign, path: '/payroll' }],
  },
  {
    label: 'Insights',
    icon: FileText,
    items: [{ label: 'Reports', icon: FileText, path: '/reports' }],
  },
  {
    label: 'Admin',
    icon: Settings,
    items: [{ label: 'Settings', icon: Settings, path: '/settings' }],
  },
];

export default function Sidebar({ open, onClose }) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState(() =>
    navGroups.reduce((groups, group) => ({
      ...groups,
      [group.label]: group.items.some(item => item.path === location.pathname) || group.label === 'Dashboard',
    }), {})
  );

  const toggleGroup = (label) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 z-30 flex flex-col transition-transform duration-300",
        "bg-navy-800",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )} style={{ backgroundColor: 'hsl(222, 47%, 11%)' }}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Fingerprint className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">PaySync PH</p>
              <p className="text-white/40 text-xs">Payroll System</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {navGroups.map(group => {
              const GroupIcon = group.icon;
              const groupActive = group.items.some(item => item.path === location.pathname);
              const expanded = openGroups[group.label];

              return (
                <div key={group.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150",
                      groupActive ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/8"
                    )}
                  >
                    <GroupIcon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronRight className={cn("w-3.5 h-3.5 transition-transform opacity-70", expanded && "rotate-90")} />
                  </button>

                  {expanded && (
                    <div className="mt-1 ml-4 space-y-0.5 border-l border-white/10 pl-2">
                      {group.items.map(item => {
                        const active = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                              active
                                ? "bg-primary text-white"
                                : "text-white/55 hover:text-white hover:bg-white/8"
                            )}
                          >
                            <item.icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="flex-1">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <p className="text-white/30 text-xs px-1">PaySync PH v1.0</p>
        </div>
      </aside>
    </>
  );
}
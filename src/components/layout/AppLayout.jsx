import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import PagePermissionGate from '@/components/auth/PagePermissionGate';
import CoachedTour from '@/components/tour/CoachedTour';

const pageTitles = {
  '/': 'Dashboard',
  '/employees': 'Employees',
  '/airtable-employees': 'Airtable Employee List',
  '/organization-setup': 'Organization Setup',
  '/companies': 'Companies',
  '/branches': 'Branches',
  '/departments': 'Departments',
  '/department-roles': 'Department Roles',
  '/teams': 'Teams',
  '/user-management': 'User Management',
  '/attendance': 'Attendance',
  '/attendance-upload': 'Upload Attendance',
  '/shifts': 'Shift Schedules',
  '/schedule-proposal': 'Schedule Proposal',
  '/schedule-requests': 'Schedule Requests',
  '/leaves': 'Leave Requests',
  '/overtime': 'Overtime',
  '/payroll': 'Payroll',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/permissions': 'Page Permissions',
  '/role-hierarchy': 'Role Hierarchy',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'PaySync PH';

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main data-tour="page-content" className="flex-1 p-4 lg:p-6 overflow-auto">
          <PagePermissionGate>
            <Outlet />
          </PagePermissionGate>
        </main>
      </div>
      <CoachedTour />
    </div>
  );
}
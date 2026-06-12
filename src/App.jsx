import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { UploadProvider } from '@/context/UploadContext';
import { TourProvider } from '@/context/TourContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import EmployeeAccessGate from '@/components/auth/EmployeeAccessGate';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import AirtableEmployees from './pages/AirtableEmployees';
import Departments from './pages/Departments';
import Attendance from './pages/Attendance';
import AttendanceUpload from './pages/AttendanceUpload';
import Shifts from './pages/Shifts';
import Leaves from './pages/Leaves';
import Overtime from './pages/Overtime';
import Offsets from './pages/Offsets';
import Deductions from './pages/Deductions';
import Payroll from './pages/Payroll';
import ThirteenthMonth from './pages/ThirteenthMonth';
import TaxCompliance from './pages/TaxCompliance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ScheduleProposal from './pages/ScheduleProposal';
import ScheduleRequests from './pages/ScheduleRequests';
import ApprovedSchedule from './pages/ApprovedSchedule';
import Reconciliation from './pages/Reconciliation';
import ScheduleLinks from './pages/ScheduleLinks';
import ScheduleChangeHistory from './pages/ScheduleChangeHistory';
import OrganizationSetup from './pages/OrganizationSetup';
import Companies from './pages/Companies';
import Branches from './pages/Branches';
import DepartmentRoles from './pages/SubDepartments';
import Teams from './pages/Teams';
import UserManagement from './pages/UserManagement';
import Permissions from './pages/Permissions';
import RoleHierarchy from './pages/RoleHierarchy';
import PayrollApprovalHierarchy from './pages/PayrollApprovalHierarchy';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading PaySync PH...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/schedule/:scope/:value" element={
        <div className="min-h-screen bg-background p-4 md:p-6">
          <div className="max-w-[120rem] mx-auto"><ApprovedSchedule readOnly /></div>
        </div>
      } />
      <Route path="*" element={
        <EmployeeAccessGate>
          <GatedRoutes />
        </EmployeeAccessGate>
      } />
    </Routes>
  );
};

const GatedRoutes = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/airtable-employees" element={<AirtableEmployees />} />
        <Route path="/organization-setup" element={<OrganizationSetup />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/department-roles" element={<DepartmentRoles />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="/role-hierarchy" element={<RoleHierarchy />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/attendance-upload" element={<AttendanceUpload />} />
        <Route path="/shifts" element={<Shifts />} />
        <Route path="/schedule-proposal" element={<ScheduleProposal />} />
        <Route path="/schedule-requests" element={<ScheduleRequests />} />
        <Route path="/approved-schedule" element={<ApprovedSchedule />} />
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/schedule-links" element={<ScheduleLinks />} />
        <Route path="/schedule-change-history" element={<ScheduleChangeHistory />} />
        <Route path="/leaves" element={<Leaves />} />
        <Route path="/overtime" element={<Overtime />} />
        <Route path="/offsets" element={<Offsets />} />
        <Route path="/deductions" element={<Deductions />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/payroll-approval-hierarchy" element={<PayrollApprovalHierarchy />} />
        <Route path="/thirteenth-month" element={<ThirteenthMonth />} />
        <Route path="/tax-compliance" element={<TaxCompliance />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <UploadProvider>
          <Router>
            <TourProvider>
              <AuthenticatedApp />
            </TourProvider>
          </Router>
          <Toaster />
        </UploadProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
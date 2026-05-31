import { useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { usePagePermissions } from '@/lib/usePagePermissions';

// Blocks direct navigation to pages the current role isn't allowed to access.
// Admins always pass. The "/" dashboard is always allowed as a safe landing page.
export default function PagePermissionGate({ children }) {
  const location = useLocation();
  const { loading, isAdmin, canAccess } = usePagePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const path = location.pathname;
  const allowed = isAdmin || path === '/' || canAccess(path);

  if (!allowed) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-card border border-border rounded-2xl p-8 text-center">
        <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Access restricted</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You don't have permission to view this page. Please contact your administrator.
        </p>
      </div>
    );
  }

  return children;
}
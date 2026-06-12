import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, LockKeyhole, LogOut, Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { grantAdminAccess, hasAdminAccess, isAdminEmployeeLogin } from '@/lib/adminAccess';

export default function EmployeeAccessGate({ children }) {
  const { logout, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const checkAccess = async (attempt = 0) => {
    if (hasAdminAccess()) {
      setAllowed(true);
      setLoading(false);
      return;
    }

    try {
      const res = await base44.functions.invoke('airtableEmployees', { action: 'employeeAccessStatus' });
      setAllowed(!!res.data.allowed);
      setBlockedMessage(res.data.message || '');
      setLoading(false);
    } catch (err) {
      // Transient error (e.g. Airtable rate limit / 500): retry a couple times before giving up.
      if (attempt < 2) {
        setTimeout(() => checkAccess(attempt + 1), 1500 * (attempt + 1));
        return;
      }
      setError(err?.response?.data?.error || 'Unable to verify access right now. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAccess();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (isAdminEmployeeLogin(employeeCode, password)) {
        grantAdminAccess();
        setAllowed(true);
        setSubmitting(false);
        return;
      }

      const res = await base44.functions.invoke('airtableEmployees', {
        action: 'validateEmployeeAccess',
        employeeCode,
        password,
      });
      setAllowed(!!res.data.allowed);
      if (!res.data.allowed) setError(res.data.message || 'Invalid employee code or password.');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to sign in.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          Checking employee access...
        </div>
      </div>
    );
  }

  if (allowed) return children;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src="https://media.base44.com/images/public/6a1686805d8389bea4666b9d/517798171_GladexLogonobackground.png"
            alt="Gladex Travel and Tours Corp."
            className="w-32 h-32 object-contain mb-3"
          />
          <h1 className="text-2xl font-bold text-navy">Employee Sign In</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Use your employee code and generated password to continue.
          </p>
        </div>
        {user?.email && (
          <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>Currently logged in as <span className="font-medium text-foreground">{user.email}</span></span>
            <button type="button" onClick={() => logout(true)} className="shrink-0 font-medium text-primary hover:underline">
              Switch account
            </button>
          </div>
        )}

        {blockedMessage ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {blockedMessage}
            </div>
            <Button variant="outline" className="w-full" onClick={() => logout(true)}>
              <LogOut className="w-4 h-4" /> Log out
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Employee Code</label>
              <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="Enter employee code" className="mt-1" required />
            </div>
            <div>
              <label className="text-sm font-medium">Generated Password</label>
              <div className="relative mt-1">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="pr-10" required />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">{error}</div>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
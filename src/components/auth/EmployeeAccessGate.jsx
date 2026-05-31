import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, LockKeyhole, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';

export default function EmployeeAccessGate({ children }) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const checkAccess = async (attempt = 0) => {
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          {blockedMessage ? <LockKeyhole className="w-6 h-6 text-primary" /> : <ShieldCheck className="w-6 h-6 text-primary" />}
        </div>
        <h1 className="text-2xl font-semibold">Employee Sign In</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Use your employee code and generated password to continue.
        </p>

        {blockedMessage ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {blockedMessage}
            </div>
            <Button variant="outline" className="w-full" onClick={() => logout(true)}>
              <LogOut className="w-4 h-4" /> Log out
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-medium">Employee Code</label>
              <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="Enter employee code" className="mt-1" required />
            </div>
            <div>
              <label className="text-sm font-medium">Generated Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="mt-1" required />
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
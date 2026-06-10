import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck, Users, KeyRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import SyncStatusBanner from '@/components/sync/SyncStatusBanner';

export default function UserManagement() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const loadAccounts = async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('airtableEmployees', { action: 'employeeAccounts', refresh });
      setAccounts(res.data.accounts || []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load user accounts.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(account => [account.full_name, account.employee_code, account.email, account.job_title, account.status].some(value => String(value || '').toLowerCase().includes(q)));
  }, [accounts, search]);

  const activeCount = accounts.filter(account => account.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Employee accounts are based on active Airtable employee records.</p>
        </div>
        <Button onClick={() => loadAccounts(true)} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <SyncStatusBanner />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <Users className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-semibold">{activeCount}</p>
          <p className="text-sm text-muted-foreground">Active accounts</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <KeyRound className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-semibold">Initials + YYYYMMDD</p>
          <p className="text-sm text-muted-foreground">Generated password format</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <ShieldCheck className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-semibold">Job Title</p>
          <p className="text-sm text-muted-foreground">Assigned as internal role</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees, code, email, or role..." />
        </div>
        {error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading accounts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium">Employee</th>
                  <th className="text-left p-3 font-medium">Employee Code</th>
                  <th className="text-left p-3 font-medium">Generated Password</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map(account => (
                  <tr key={account.airtable_record_id} className="border-t border-border">
                    <td className="p-3">
                      <p className="font-medium">{account.full_name || 'Unnamed employee'}</p>
                      <p className="text-xs text-muted-foreground">{account.email || 'No email'}</p>
                    </td>
                    <td className="p-3 font-mono text-xs">{account.employee_code || '-'}</td>
                    <td className="p-3 font-mono text-xs">{account.generated_password || '-'}</td>
                    <td className="p-3">{account.job_title || '-'}</td>
                    <td className="p-3">
                      <Badge className={account.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-muted text-muted-foreground hover:bg-muted'}>
                        {account.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {filteredAccounts.length === 0 && (
                  <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
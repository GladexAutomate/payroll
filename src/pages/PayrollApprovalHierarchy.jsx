import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Network, Loader2, ShieldAlert, PenSquare, UserCheck, UserCog } from 'lucide-react';
import { usePagePermissions } from '@/lib/usePagePermissions';
import { PAYROLL_ROLE_LABELS } from '@/lib/payrollApproval';
import ApprovalRoleCard from '@/components/payroll/ApprovalRoleCard';

const CARDS = [
  { key: 'payroll_creator', icon: PenSquare, description: 'These users can create payroll runs and submit them for approval.' },
  { key: 'payroll_approver_1', icon: UserCheck, description: 'Step 1 approvers. They review submitted runs before they go to Approver 2.' },
  { key: 'payroll_approver_2', icon: UserCog, description: 'Final approvers. Their approval locks the run and archives it.' },
];

export default function PayrollApprovalHierarchy() {
  const { isAdmin, loading: loadingPerms } = usePagePermissions();
  const [accounts, setAccounts] = useState([]);
  const [roles, setRoles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [res, roleRecords] = await Promise.all([
        base44.functions.invoke('airtableEmployees', { action: 'employeeAccounts' }),
        base44.entities.PayrollApprovalRole.list('-updated_date', 50),
      ]);
      const sorted = (res.data.accounts || []).sort((a, b) =>
        String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''))
      );
      setAccounts(sorted);
      const map = {};
      roleRecords.forEach((r) => { map[r.role_key] = r; });
      setRoles(map);
      setLoading(false);
    })();
  }, []);

  const saveRole = async (key, emails) => {
    const existing = roles[key];
    if (existing) {
      const updated = await base44.entities.PayrollApprovalRole.update(existing.id, { user_emails: emails });
      setRoles((prev) => ({ ...prev, [key]: { ...existing, ...updated, user_emails: emails } }));
    } else {
      const created = await base44.entities.PayrollApprovalRole.create({ role_key: key, user_emails: emails });
      setRoles((prev) => ({ ...prev, [key]: created }));
    }
  };

  if (loadingPerms) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-card border border-border rounded-2xl p-8 text-center">
        <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Admins only</h2>
        <p className="text-sm text-muted-foreground mt-1">Only administrators can manage the payroll approval hierarchy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Network className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Payroll Approval Hierarchy</h1>
          <p className="text-sm text-muted-foreground">Assign who can create payroll runs and who approves them at each step. Admins can always perform every step.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {CARDS.map((card) => (
            <ApprovalRoleCard
              key={card.key}
              title={PAYROLL_ROLE_LABELS[card.key]}
              description={card.description}
              icon={card.icon}
              accounts={accounts}
              selected={roles[card.key]?.user_emails || []}
              onSave={(emails) => saveRole(card.key, emails)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
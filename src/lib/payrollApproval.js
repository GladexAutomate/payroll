import { base44 } from '@/api/base44Client';

export const PAYROLL_ROLE_KEYS = ['payroll_creator', 'payroll_approver_1', 'payroll_approver_2'];

export const PAYROLL_ROLE_LABELS = {
  payroll_creator: 'Payroll Creators',
  payroll_approver_1: 'Approver 1',
  payroll_approver_2: 'Approver 2',
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

// Load the current user + their payroll approval capabilities.
// Admins can do every step regardless of assignment.
export async function loadPayrollApprovalContext() {
  const [user, roles] = await Promise.all([
    base44.auth.me(),
    base44.entities.PayrollApprovalRole.list('-updated_date', 50),
  ]);

  const email = normalizeEmail(user?.email);
  const isAdmin = user?.role === 'admin';

  const assignedTo = (key) => {
    const record = roles.find((r) => r.role_key === key);
    return (record?.user_emails || []).map(normalizeEmail).includes(email);
  };

  return {
    user,
    email,
    isAdmin,
    canCreate: isAdmin || assignedTo('payroll_creator'),
    canApprove1: isAdmin || assignedTo('payroll_approver_1'),
    canApprove2: isAdmin || assignedTo('payroll_approver_2'),
  };
}
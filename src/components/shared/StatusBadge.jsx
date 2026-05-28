import { cn } from '@/lib/utils';

const configs = {
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-gray-50 text-gray-600 border-gray-200',
  terminated: 'bg-red-50 text-red-700 border-red-200',
  present: 'bg-green-50 text-green-700 border-green-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-orange-50 text-orange-700 border-orange-200',
  half_day: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  on_leave: 'bg-blue-50 text-blue-700 border-blue-200',
  holiday: 'bg-purple-50 text-purple-700 border-purple-200',
  rest_day: 'bg-gray-50 text-gray-600 border-gray-200',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  draft: 'bg-gray-50 text-gray-600 border-gray-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  computing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  released: 'bg-green-50 text-green-700 border-green-200',
  computed: 'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  partial: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  regular: 'bg-blue-50 text-blue-700 border-blue-200',
  probationary: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  contractual: 'bg-orange-50 text-orange-700 border-orange-200',
};

export default function StatusBadge({ status, label }) {
  const style = configs[status] || 'bg-gray-50 text-gray-600 border-gray-200';
  const display = label || (status ? status.replace(/_/g, ' ') : '');
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize', style)}>
      {display}
    </span>
  );
}
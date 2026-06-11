import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const filters = [
  { key: 'pending_hr_review', label: 'Pending HR Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const sorts = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'team', label: 'Team A–Z' },
];

export default function RequestToolbar({ filter, setFilter, counts, search, setSearch, sort, setSort }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map(item => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${filter === item.key ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-300 text-slate-600 hover:text-slate-900'}`}
          >
            {item.label}
            <span className={`ml-1.5 ${filter === item.key ? 'text-blue-100' : 'text-slate-400'}`}>{counts[item.key] || 0}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search team, leader or department" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {sorts.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}
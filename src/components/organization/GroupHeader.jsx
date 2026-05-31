import { Building2, MapPin } from 'lucide-react';

export default function GroupHeader({ company, branch, count }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
        <Building2 className="w-4 h-4" /> {company}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-800">
        <MapPin className="w-4 h-4" /> {branch}
      </span>
      {typeof count === 'number' && (
        <span className="text-xs text-muted-foreground">{count} {count === 1 ? 'item' : 'items'}</span>
      )}
    </div>
  );
}
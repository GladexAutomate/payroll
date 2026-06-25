import { ArrowDownZA, ArrowUpAZ, X, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import EditableColumnHeader from '@/components/airtable/EditableColumnHeader';

export default function ColumnSortFilter({
  name,
  filterValue,
  sortDirection,
  onRename,
  onFilterChange,
  onSortChange,
  onHide,
}) {
  return (
    <div className="space-y-2 normal-case tracking-normal">
      <div className="flex items-center justify-between gap-2 uppercase tracking-wide">
        <EditableColumnHeader name={name} onRename={onRename} />
        <div className="flex items-center gap-1">
          {onHide && (
            <button
              type="button"
              onClick={() => onHide(name)}
              className="p-1 rounded border bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              title="Hide this column"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onSortChange(name, sortDirection === 'asc' ? null : 'asc')}
            className={`p-1 rounded border ${sortDirection === 'asc' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}
            title="Sort A to Z"
          >
            <ArrowUpAZ className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSortChange(name, sortDirection === 'desc' ? null : 'desc')}
            className={`p-1 rounded border ${sortDirection === 'desc' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}
            title="Sort Z to A"
          >
            <ArrowDownZA className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="relative">
        <Input
          value={filterValue || ''}
          onChange={(e) => onFilterChange(name, e.target.value)}
          placeholder="Filter..."
          className="h-7 pr-7 text-xs normal-case"
        />
        {filterValue && (
          <button
            type="button"
            onClick={() => onFilterChange(name, '')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title="Clear filter"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
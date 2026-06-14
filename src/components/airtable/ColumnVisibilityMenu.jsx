import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export default function ColumnVisibilityMenu({ columns, hiddenColumns, onToggle, onShowAll }) {
  const hiddenCount = hiddenColumns.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <EyeOff className="w-4 h-4 mr-1.5" />
          Columns{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto w-64">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Show / hide columns</DropdownMenuLabel>
          {hiddenCount > 0 && (
            <button onClick={onShowAll} className="text-xs text-primary hover:underline">Show all</button>
          )}
        </div>
        <DropdownMenuSeparator />
        {columns.map(col => {
          const hidden = hiddenColumns.includes(col);
          return (
            <DropdownMenuItem
              key={col}
              onSelect={(e) => { e.preventDefault(); onToggle(col); }}
              className="flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className={`truncate text-xs ${hidden ? 'text-muted-foreground line-through' : ''}`}>{col}</span>
              {hidden
                ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                : <Eye className="w-3.5 h-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
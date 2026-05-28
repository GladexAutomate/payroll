import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SetupCard({ title, subtitle, count, onManage, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{title}</p>
            {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
          </div>
        </div>
        {typeof count === 'number' && <span className="text-xs rounded-full bg-muted px-2 py-1 text-muted-foreground shrink-0">{count}</span>}
      </div>
      {children}
      {onManage && <Button variant="outline" size="sm" onClick={onManage} className="w-full">Manage Mapping</Button>}
    </div>
  );
}
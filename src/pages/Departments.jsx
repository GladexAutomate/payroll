import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('airtableEmployees', { action: 'departments' });
    setDepartments(res.data?.departments || []);
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base">Departments from Airtable</h2>
          <p className="text-sm text-muted-foreground">These departments are pulled from the Airtable Employee List.</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />)
        ) : departments.length === 0 ? (
          <div className="col-span-full bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            No departments found in Airtable yet.
          </div>
        ) : departments.map(dept => (
          <div key={dept.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{dept.name}</p>
                {dept.code && <p className="text-xs text-muted-foreground">{dept.code}</p>}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{dept.employee_count || 0} employees</span>
              <span className="text-xs text-primary font-medium">Airtable</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
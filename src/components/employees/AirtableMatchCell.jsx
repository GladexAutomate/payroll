import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Link2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AirtableMatchCell({ employee, match, airtableRecords, onConnect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return airtableRecords.slice(0, 20);
    return airtableRecords.filter(record => {
      const fields = record.fields || {};
      const text = [record.full_name, fields['Full Name'], fields['First Name'], fields['Last Name'], fields['Employee Code ID'], record.employee_code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    }).slice(0, 20);
  }, [airtableRecords, query]);

  const selectedRecord = airtableRecords.find(record => record.airtable_record_id === selectedId || record.id === selectedId);
  const matched = match?.airtable_record_id;

  return (
    <div className="min-w-[260px]">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className={matched ? 'font-medium text-foreground truncate' : 'text-amber-600 font-medium'}>
          {matched ? (match.airtable_full_name || 'Matched') : 'No match'}
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-background p-2 space-y-2 shadow-sm">
          {matched && (
            <div className="text-xs text-muted-foreground">
              <p>Connected to Airtable.</p>
              <p>Biometrics Number: <span className="font-medium text-foreground">{employee.employee_id || '—'}</span></p>
            </div>
          )}

          {!matched && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search Airtable employee..."
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Select employee</option>
                {filteredRecords.map(record => {
                  const fields = record.fields || {};
                  const id = record.airtable_record_id || record.id;
                  const name = record.full_name || fields['Full Name'] || [fields['First Name'], fields['Last Name']].filter(Boolean).join(' ');
                  return <option key={id} value={id}>{name || id}</option>;
                })}
              </select>
              <Button
                type="button"
                size="sm"
                className="h-8 w-full text-xs"
                disabled={!selectedRecord}
                onClick={() => onConnect(employee, selectedRecord, 'manual')}
              >
                <Link2 className="w-3.5 h-3.5 mr-1" /> Connect
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

// Team dropdown filtered to teams under the selected company/branch/department/role.
// Also lets the user create a brand-new team (saved to the Teams page under the selected org).
export default function TeamSelectField({ value, onChange, teamOptions, onCreateTeam, disabled }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    await onCreateTeam(trimmed);
    setBusy(false);
    setNewName('');
    setCreating(false);
  };

  if (creating) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New team name"
          disabled={busy}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
        />
        <Button type="button" size="sm" onClick={handleCreate} disabled={busy || !newName.trim()}>
          {busy ? 'Saving...' : 'Add'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setCreating(false); setNewName(''); }} disabled={busy}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 border border-input rounded-md px-3 h-9 text-sm bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Select team</option>
        {teamOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
      </select>
      <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)} disabled={disabled}>
        <Plus className="w-4 h-4 mr-1" /> New
      </Button>
    </div>
  );
}
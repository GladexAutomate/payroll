import { useMemo, useState } from 'react';
import { Search, Save, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export default function ApprovalRoleCard({ title, description, icon: Icon, accounts, selected, onSave }) {
  const [emails, setEmails] = useState(() => new Set((selected || []).map(normalizeEmail)));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withEmail = accounts.filter((a) => a.email);
    if (!q) return withEmail;
    return withEmail.filter((a) =>
      [a.full_name, a.email, a.employee_code, a.job_title].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [accounts, search]);

  const toggle = (email) => {
    const key = normalizeEmail(email);
    setEmails((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await onSave([...emails]);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="bg-card border border-border rounded-xl flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-primary" />}
          <h3 className="font-semibold">{title}</h3>
          <span className="ml-auto text-xs text-muted-foreground">{emails.size} assigned</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="pl-9" />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>
        ) : filtered.map((a) => {
          const key = normalizeEmail(a.email);
          const on = emails.has(key);
          return (
            <button
              key={a.email}
              onClick={() => toggle(a.email)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
            >
              <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary' : 'border-input'}`}>
                {on && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">{a.full_name || a.email}</span>
                <span className="block text-xs text-muted-foreground truncate">{a.email}{a.job_title ? ` · ${a.job_title}` : ''}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{saved ? 'Saved.' : ''}</span>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}
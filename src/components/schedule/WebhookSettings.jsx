import { useEffect, useState } from 'react';
import { Link2, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function WebhookSettings() {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({ approved_schedule_webhook: '', rejected_schedule_webhook: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const records = await base44.entities.AppSettings.filter({ key: 'schedule_webhooks' }, '-created_date', 1);
    const settings = records[0];
    if (settings) {
      setRecord(settings);
      setForm({
        approved_schedule_webhook: settings.approved_schedule_webhook || '',
        rejected_schedule_webhook: settings.rejected_schedule_webhook || '',
      });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (record) {
      await base44.entities.AppSettings.update(record.id, { key: 'schedule_webhooks', ...form });
    } else {
      const created = await base44.entities.AppSettings.create({ key: 'schedule_webhooks', ...form });
      setRecord(created);
    }
    setSaving(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <Link2 className="w-4 h-4 text-primary" />
        <div>
          <h3 className="font-semibold text-sm">Schedule Approval Webhooks</h3>
          <p className="text-xs text-muted-foreground">URLs will be called when a schedule proposal is approved or rejected.</p>
        </div>
      </div>
      <form onSubmit={save} className="space-y-3">
        <div>
          <Label className="text-xs">Approved Schedule Webhook</Label>
          <Input className="mt-1" placeholder="https://..." value={form.approved_schedule_webhook} onChange={e => setForm(p => ({ ...p, approved_schedule_webhook: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Rejected Schedule Webhook</Label>
          <Input className="mt-1" placeholder="https://..." value={form.rejected_schedule_webhook} onChange={e => setForm(p => ({ ...p, rejected_schedule_webhook: e.target.value }))} />
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving...' : 'Save Webhooks'}
        </Button>
      </form>
    </div>
  );
}
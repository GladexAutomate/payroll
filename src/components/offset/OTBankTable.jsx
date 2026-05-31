import { Wallet } from 'lucide-react';
import { getAirtableEmployeeName } from '@/utils/airtableEmployee';

// Computes each employee's OT bank: total approved OT earned minus offset hours used.
export default function OTBankTable({ overtime = [], offsets = [], empMap = {}, loading }) {
  const bank = {};
  const ensure = (id) => { bank[id] = bank[id] || { earned: 0, used: 0 }; return bank[id]; };

  overtime.forEach(ot => {
    const hrs = Number(ot.approved_hours ?? ot.requested_hours) || 0;
    if (hrs > 0) ensure(ot.employee_id).earned += hrs;
  });
  offsets.filter(o => o.status === 'approved').forEach(o => {
    ensure(o.employee_id).used += Number(o.offset_hours) || 0;
  });

  const rows = Object.entries(bank)
    .map(([id, v]) => ({ id, ...v, balance: v.earned - v.used, emp: empMap[id] }))
    .filter(r => r.earned > 0 || r.used > 0)
    .sort((a, b) => b.balance - a.balance);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <Wallet className="w-4.5 h-4.5 text-primary" />
        <div>
          <h3 className="font-semibold text-sm">Overtime Bank</h3>
          <p className="text-xs text-muted-foreground">Approved OT earned vs. offset hours used</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">OT Earned</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Offset Used</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => <tr key={i} className="border-b border-border/50">{[...Array(4)].map((_, j) => <td key={j} className="py-3 px-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>)
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">No banked overtime yet.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-3 px-4 font-medium">{r.emp ? getAirtableEmployeeName(r.emp) : r.id}</td>
                <td className="py-3 px-4 text-right text-green-600 font-medium">{r.earned.toFixed(1)}h</td>
                <td className="py-3 px-4 text-right text-orange-600">{r.used.toFixed(1)}h</td>
                <td className={`py-3 px-4 text-right font-bold ${r.balance < 0 ? 'text-red-600' : 'text-foreground'}`}>{r.balance.toFixed(1)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
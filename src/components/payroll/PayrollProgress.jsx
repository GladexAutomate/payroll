export default function PayrollProgress({ run }) {
  const progress = Math.max(0, Math.min(100, Math.round(Number(run.compute_progress) || 0)));
  const processed = Number(run.compute_processed) || 0;
  const total = Number(run.compute_total) || 0;

  if (run.status !== 'computing') return null;

  return (
    <div className="mt-2 min-w-[180px]">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
        <span>Computing payroll</span>
        <span className="font-semibold text-primary">{progress}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {total > 0 && (
        <p className="mt-1 text-[10px] text-muted-foreground text-right">
          {processed} of {total} records
        </p>
      )}
    </div>
  );
}
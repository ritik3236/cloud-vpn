import { cn } from '@/lib/cn';

import { TONE_CLASS, type Tone } from './tone';

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {tone ? (
          <span className={cn('size-1.5 rounded-full', TONE_CLASS[tone].split(' ')[0])} aria-hidden />
        ) : null}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

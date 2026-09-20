import { cn } from '@/lib/cn';

import { TONE_CLASS, type Tone } from './tone';

/** Metadata reads as a pill attached to the value, not as a sentence fragment beside it. */
export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Spark's `Copyable`, ported to this project's Tailwind conventions per its own integration
 * guide. Only the `pop` confirmation is carried over — the confetti variants would make routine
 * work stop for applause, and copying a key in an admin table is routine work.
 *
 * `display` is what the eye reads (usually truncated); `value` is always what lands on the
 * clipboard, and the full string stays reachable in the title.
 */
export interface CopyableProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
  display?: string;
  label?: string;
  mono?: boolean;
  dwell?: number;
}

export function Copyable({
  value,
  display,
  label,
  mono = true,
  dwell = 900,
  className,
  ...rest
}: CopyableProps) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // The row around this may itself be clickable; a copy must not also open the row.
      event.stopPropagation();
      event.preventDefault();
      navigator.clipboard?.writeText(value).catch(() => {});
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), dwell);
    },
    [value, dwell],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      title={value}
      aria-label={`Copy ${label ?? value}`}
      className={cn(
        'group inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left',
        'transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
      {...rest}
    >
      <span className="relative inline-flex size-3.5 shrink-0 items-center justify-center">
        <Copy
          aria-hidden
          className={cn(
            'absolute size-3.5 text-muted-foreground transition-all duration-200',
            copied ? 'scale-50 opacity-0' : 'scale-100 opacity-100',
          )}
        />
        <Check
          aria-hidden
          className={cn(
            'absolute size-3.5 text-tone-live transition-all duration-200',
            copied ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
        />
      </span>
      <span className={cn('truncate', mono && 'font-mono text-[0.8125rem]')}>
        {display ?? value}
      </span>
    </button>
  );
}

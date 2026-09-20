'use client';

import { Check, Palette } from 'lucide-react';
import * as React from 'react';

import {
  APPEARANCE_STORAGE_KEY,
  APPEARANCES,
  DEFAULT_APPEARANCE,
  type AppearanceMode,
} from '@/design-system/appearance';
import { Button } from '@/design-system/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/design-system/ui/popover';
import { cn } from '@/lib/cn';

const GROUPS: { mode: AppearanceMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

/**
 * The active palette lives on <html>, put there before paint by the inline script — it is
 * external state, so it is read with useSyncExternalStore rather than copied into an effect.
 * That keeps the server and first client render agreeing without a flash or a cascading render.
 */
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const readAppearance = () => document.documentElement.dataset.appearance ?? DEFAULT_APPEARANCE;
const serverAppearance = () => DEFAULT_APPEARANCE;

function applyAppearance(id: string) {
  document.documentElement.setAttribute('data-appearance', id);
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, id);
  } catch {
    // Private browsing: the palette still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

export function AppearancePicker({ className }: { className?: string }) {
  const active = React.useSyncExternalStore(subscribe, readAppearance, serverAppearance);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 w-full justify-start gap-2 px-2', className)}
        >
          <Palette className="size-4" />
          <span className="text-sm">Appearance</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-2">
        {GROUPS.map((group) => (
          <div key={group.mode} className="mb-2 last:mb-0">
            <p className="px-2 pb-1 text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {APPEARANCES.filter((appearance) => appearance.mode === group.mode).map((appearance) => (
                <button
                  key={appearance.id}
                  type="button"
                  onClick={() => applyAppearance(appearance.id)}
                  aria-pressed={active === appearance.id}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full border border-border"
                    style={{
                      background: `linear-gradient(135deg, ${appearance.swatch[0]} 50%, ${appearance.swatch[1]} 50%)`,
                    }}
                  />
                  <span className="flex-1 text-left">{appearance.name}</span>
                  {active === appearance.id ? <Check className="size-3.5" /> : null}
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

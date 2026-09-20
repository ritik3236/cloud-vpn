'use client';

import { useClerk } from '@clerk/nextjs';
import { KeyRound, LogOut } from 'lucide-react';

import { AppearancePicker } from '@/features/appearance/appearance-picker';
import { Button } from '@/design-system/ui/button';

export function MeHeader() {
  const { signOut } = useClerk();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <KeyRound className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">Cloud VPN</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-36">
          <AppearancePicker />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2"
          onClick={() => signOut({ redirectUrl: '/sign-in' })}
        >
          <LogOut className="size-4" />
          <span className="hidden text-sm sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}

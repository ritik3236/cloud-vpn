'use client';

import { useClerk } from '@clerk/nextjs';
import { LayoutGrid, LogOut } from 'lucide-react';
import Link from 'next/link';

import { AppearancePicker } from '@/features/appearance/appearance-picker';
import { PORTAL } from '@/features/services/registry';
import { Button } from '@/design-system/ui/button';

/**
 * One header for every surface outside a service's own chrome. The portal name is always a link
 * home, so a service is never a dead end — the way back to the others is where the eye already is.
 */
export function PortalHeader({ service, signedIn }: { service?: string; signedIn: boolean }) {
  const { signOut } = useClerk();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LayoutGrid className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">{PORTAL.name}</span>
        </Link>
        {service ? (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate text-sm text-muted-foreground">{service}</span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <div className="w-36">
          <AppearancePicker />
        </div>
        {signedIn ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
          >
            <LogOut className="size-4" />
            <span className="hidden text-sm sm:inline">Log out</span>
          </Button>
        ) : (
          <Button asChild size="sm" className="h-8">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}

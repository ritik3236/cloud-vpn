'use client';

import { MoreHorizontal, Unplug, UserCheck, UserMinus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/design-system/ui/alert-dialog';
import { Button } from '@/design-system/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/design-system/ui/dropdown-menu';
import { pluralise } from '@/lib/format';

import { reactivateUserAction, suspendUserAction } from './actions';
import type { Access } from './presence';

export function UserRowActions({
  user,
}: {
  user: { id: string; label: string; status: string; liveConfigs: number; access: Access };
}) {
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);

  const run = (action: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });

  const active = user.status === 'active';
  const local = user.access === 'local';
  /**
   * Blocking sign-in and stopping tunnels are two halves of the same action, and the first half
   * can already be done — banned in Clerk directly, or the Clerk account gone. Then the tunnels
   * are the only thing left to cut, and saying "suspend" would describe work already finished.
   * A no-login person has no first half at all: suspending them is stopping their tunnels and
   * keeping new configs from being assigned to them.
   */
  const tunnelsOnly = user.liveConfigs > 0 && (user.access === 'missing' || (!active && !local));
  const canSuspend = tunnelsOnly || (active && user.access !== 'missing');
  const canReactivate = !active && user.access !== 'missing';
  if (!canSuspend && !canReactivate) return null;

  const stop = () => {
    setConfirming(false);
    run(() => suspendUserAction(user.id));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Actions for ${user.label}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canSuspend ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                setConfirming(true);
              }}
            >
              {tunnelsOnly ? <Unplug className="size-4" /> : <UserMinus className="size-4" />}
              {tunnelsOnly ? 'Stop live tunnels' : 'Suspend access'}
            </DropdownMenuItem>
          ) : null}
          {canReactivate ? (
            <DropdownMenuItem disabled={pending} onSelect={() => run(() => reactivateUserAction(user.id))}>
              <UserCheck className="size-4" />
              Reactivate
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tunnelsOnly ? `Stop ${user.label}'s tunnels?` : `Suspend ${user.label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tunnelsOnly
                ? `${user.access === 'missing' ? 'They have no Clerk account, so they cannot sign in' : 'They are already blocked from signing in'}, but ${pluralise(user.liveConfigs, 'tunnel')} still connects. This disables the configs rather than revoking them, so you can re-enable them later.`
                : local
                  ? user.liveConfigs > 0
                    ? `This stops ${pluralise(user.liveConfigs, 'live tunnel')} immediately and keeps new configs from being assigned to them. They have no login, so there is nothing else to block. The configs are disabled, not revoked, so you can re-enable them later.`
                    : 'This keeps new configs from being assigned to them. They hold no live tunnels, so nothing disconnects.'
                  : user.liveConfigs > 0
                    ? `This bans them in Clerk — signed out everywhere, no sign-in — and stops ${pluralise(user.liveConfigs, 'live tunnel')} immediately. The configs are disabled, not revoked, so you can re-enable them individually later.`
                    : 'This bans them in Clerk — signed out everywhere, no sign-in. They hold no live tunnels, so nothing disconnects.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">
              {tunnelsOnly ? 'Leave them connected' : 'Keep access'}
            </AlertDialogCancel>
            <Button variant="destructive" size="sm" className="h-8" onClick={stop}>
              {tunnelsOnly ? <Unplug className="size-4" /> : <UserMinus className="size-4" />}
              {pending
                ? tunnelsOnly
                  ? 'Stopping…'
                  : 'Suspending…'
                : tunnelsOnly
                  ? 'Stop Tunnels'
                  : `Suspend ${user.label}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

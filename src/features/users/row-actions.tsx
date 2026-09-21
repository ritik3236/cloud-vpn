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

export function UserRowActions({
  user,
}: {
  user: { id: string; label: string; status: string; liveConfigs: number; inClerk: boolean };
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
  /**
   * Blocking sign-in and stopping tunnels are two halves of the same action, and the first half
   * can already be done — banned in Clerk directly, or no Clerk account at all. Then the tunnels
   * are the only thing left to cut, and saying "suspend" would describe work already finished.
   */
  const tunnelsOnly = user.liveConfigs > 0 && (!active || !user.inClerk);
  const canSuspend = tunnelsOnly || (active && user.inClerk);
  const canReactivate = !active && user.inClerk;
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
                ? `${user.inClerk ? 'They are already blocked from signing in' : 'They have no Clerk account, so they cannot sign in'}, but ${pluralise(user.liveConfigs, 'tunnel')} still connects. This disables the configs rather than revoking them, so you can re-enable them later.`
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

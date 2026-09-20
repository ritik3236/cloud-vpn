'use client';

import { MoreHorizontal, UserCheck, UserMinus } from 'lucide-react';
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
  user: { id: string; label: string; status: string; liveConfigs: number };
}) {
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);

  const run = (action: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Actions for ${user.label}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {user.status === 'active' ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                setConfirming(true);
              }}
            >
              <UserMinus className="size-4" />
              Suspend access
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={pending} onSelect={() => run(() => reactivateUserAction(user.id))}>
              <UserCheck className="size-4" />
              Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {user.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {user.liveConfigs > 0
                ? `This stops ${pluralise(user.liveConfigs, 'live tunnel')} immediately. The configs are disabled, not revoked, so you can re-enable them individually later.`
                : 'They hold no live tunnels, so nothing disconnects. They keep their configs but cannot be assigned new ones.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Keep access</AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => {
                setConfirming(false);
                run(() => suspendUserAction(user.id));
              }}
            >
              <UserMinus className="size-4" />
              {pending ? 'Suspending…' : `Suspend ${user.label}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

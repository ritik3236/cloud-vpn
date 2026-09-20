'use client';

import { MoreHorizontal, Power, PowerOff, Trash2 } from 'lucide-react';
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
import { Input } from '@/design-system/ui/input';

import { disableConfigAction, enableConfigAction, revokeConfigAction } from './actions';

export type ConfigActionRow = {
  id: string;
  status: string;
  assignedIp: string | null;
  deviceLabel: string | null;
  userLabel: string | null;
};

export function ConfigRowActions({ config }: { config: ConfigActionRow }) {
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const [typed, setTyped] = React.useState('');

  const name = config.assignedIp ?? config.id;
  // Revoking a spare nobody holds is not the same act as killing a live tunnel, so the speed
  // bump is sized to the damage rather than applied uniformly.
  const isLive = config.status === 'active';

  const run = (action: () => Promise<{ ok: boolean; message?: string; error?: string }>, undo?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message, undo ? { action: { label: 'Undo', onClick: undo }, duration: 8000 } : undefined);
      } else {
        toast.error(result.error);
      }
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Actions for ${name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {config.status === 'active' ? (
            // Reversible, so it just happens and offers undo — no modal in the way.
            <DropdownMenuItem
              disabled={pending}
              onSelect={() =>
                run(
                  () => disableConfigAction(config.id),
                  () => run(() => enableConfigAction(config.id)),
                )
              }
            >
              <PowerOff className="size-4" />
              Disable tunnel
            </DropdownMenuItem>
          ) : null}

          {config.status === 'disabled' ? (
            <DropdownMenuItem disabled={pending} onSelect={() => run(() => enableConfigAction(config.id))}>
              <Power className="size-4" />
              Re-enable tunnel
            </DropdownMenuItem>
          ) : null}

          {config.status !== 'revoked' ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                setTyped('');
                setConfirming(true);
              }}
            >
              <Trash2 className="size-4" />
              Revoke permanently
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isLive
                ? `This kills ${config.userLabel ?? 'this user'}'s tunnel immediately and cannot be undone. Their config file stops working and its address returns to the pool.`
                : 'This config can never be used again, and its address returns to the pool.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isLive ? (
            <div className="space-y-1.5">
              <label htmlFor="confirm-ip" className="text-sm">
                Type <span className="font-mono font-medium">{name}</span> to confirm
              </label>
              <Input
                id="confirm-ip"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                className="h-8 font-mono"
                autoComplete="off"
              />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Keep it</AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => {
                if (isLive && typed !== name) {
                  toast.error(`Type ${name} exactly to confirm.`);
                  return;
                }
                setConfirming(false);
                run(() => revokeConfigAction(config.id));
              }}
            >
              <Trash2 className="size-4" />
              {pending ? 'Revoking…' : `Revoke ${name}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

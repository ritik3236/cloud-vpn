'use client';

import { Download, MoreHorizontal, Power, PowerOff, Trash2, Undo2, UserPlus } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design-system/ui/dialog';
import { Label } from '@/design-system/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/design-system/ui/select';

import { ConfigFileDialog } from './config-file-dialog';
import {
  assignConfigAction,
  disableConfigAction,
  enableConfigAction,
  retrieveConfigAction,
  revokeConfigAction,
  unassignConfigAction,
} from './actions';
import type { RetrieveResult } from './actions';

export type AssignableUser = { id: string; label: string };

export type ConfigActionRow = {
  id: string;
  status: string;
  assignedIp: string | null;
  deviceLabel: string | null;
  userLabel: string | null;
};

export function ConfigRowActions({
  config,
  users,
  canRetrieve = false,
}: {
  config: ConfigActionRow;
  users: AssignableUser[];
  /** Retrieving key material is admin-only (SPEC §2) — ops never sees a private key. */
  canRetrieve?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const [returning, setReturning] = React.useState(false);
  const [assigning, setAssigning] = React.useState(false);
  const [assignee, setAssignee] = React.useState<string>('');
  const [fileOpen, setFileOpen] = React.useState(false);
  const [file, setFile] = React.useState<RetrieveResult | null>(null);
  const [fetching, startFetch] = React.useTransition();

  const name = config.assignedIp ?? config.id;
  // Revoking is irreversible but not catastrophic: the fix is issuing a new config, which takes
  // seconds. That is 'awkward', so it gets a confirm that names the deed — not type-the-name,
  // which is for damage you genuinely cannot undo.
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
          {canRetrieve && config.status !== 'revoked' ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setFile(null);
                setFileOpen(true);
                startFetch(async () => setFile(await retrieveConfigAction(config.id)));
              }}
            >
              <Download className="size-4" />
              Get config
            </DropdownMenuItem>
          ) : null}

          {config.status === 'unassigned' ? (
            <DropdownMenuItem
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                setAssignee('');
                setAssigning(true);
              }}
            >
              <UserPlus className="size-4" />
              Assign to…
            </DropdownMenuItem>
          ) : null}

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

          {config.status === 'active' ? (
            <DropdownMenuItem
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                setReturning(true);
              }}
            >
              <Undo2 className="size-4" />
              Return to pool
            </DropdownMenuItem>
          ) : null}

          {config.status !== 'revoked' ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                setConfirming(true);
              }}
            >
              <Trash2 className="size-4" />
              Revoke permanently
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfigFileDialog
        open={fileOpen}
        onOpenChange={setFileOpen}
        label={config.deviceLabel ?? name}
        result={file}
        pending={fetching}
      />

      <Dialog open={assigning} onOpenChange={setAssigning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign {name}</DialogTitle>
            <DialogDescription>
              This adds the peer to the node — the tunnel goes live as soon as you assign it.
            </DialogDescription>
          </DialogHeader>

          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There is nobody to assign this to yet. Add a user first, then come back.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor={`assignee-${config.id}`} className="text-sm">
                Assign to
              </Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger id={`assignee-${config.id}`} className="h-8 w-full bg-background">
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setAssigning(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8"
              disabled={users.length === 0}
              onClick={() => {
                if (!assignee) {
                  toast.error('Choose who this config is for.');
                  return;
                }
                setAssigning(false);
                run(() => assignConfigAction(config.id, assignee));
              }}
            >
              <UserPlus className="size-4" />
              {pending ? 'Assigning…' : 'Assign config'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={returning} onOpenChange={setReturning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return {name} to the pool?</AlertDialogTitle>
            <AlertDialogDescription>
              The tunnel stops and the config becomes a spare you can assign to someone else. If
              you already sent this file to {config.userLabel ?? 'them'}, revoke it instead —
              returning it to the pool does not take their copy back, and reassigning it would
              hand them someone else&apos;s tunnel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Cancel</AlertDialogCancel>
            <Button
              size="sm"
              className="h-8"
              onClick={() => {
                setReturning(false);
                run(() => unassignConfigAction(config.id));
              }}
            >
              <Undo2 className="size-4" />
              {pending ? 'Returning…' : 'Return to pool'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Keep it</AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => {
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

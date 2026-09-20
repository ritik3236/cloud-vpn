'use client';

import { MoreHorizontal, ServerOff } from 'lucide-react';
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

import { removeNodeAction } from './actions';

export function NodeRowActions({
  node,
}: {
  node: { id: string; name: string; status: string; liveConfigs: number };
}) {
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);

  const blocked = node.liveConfigs > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Actions for ${node.name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            variant="destructive"
            disabled={pending || node.status === 'disabled'}
            onSelect={(event) => {
              event.preventDefault();
              setConfirming(true);
            }}
          >
            <ServerOff className="size-4" />
            Remove node
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {node.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {blocked
                ? `${node.name} still carries ${pluralise(node.liveConfigs, 'config')}. Revoke them first — removing the node would strand the people using it.`
                : 'It stops appearing as a location for new configs. Its revoked configs keep their history, and the server itself is left untouched — shut it down yourself once you are done with it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Cancel</AlertDialogCancel>
            {/* Not disabled to express the block — it stays clickable and says what is wrong. */}
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => {
                if (blocked) {
                  toast.error(`Revoke ${node.name}'s configs before removing it.`);
                  return;
                }
                setConfirming(false);
                startTransition(async () => {
                  const result = await removeNodeAction(node.id);
                  if (result.ok) toast.success(result.message);
                  else toast.error(result.error);
                });
              }}
            >
              <ServerOff className="size-4" />
              {pending ? 'Removing…' : `Remove ${node.name}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

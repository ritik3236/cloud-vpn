'use client';

import { Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/design-system/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/design-system/ui/dialog';
import { Input } from '@/design-system/ui/input';
import { Label } from '@/design-system/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/design-system/ui/select';

import { generateConfigAction } from './actions';
import { AssigneeField, SPARE, emptyChoice, isAssigning, readChoice } from './assignee-field';
import { ConfigFileDialog } from './config-file-dialog';
import type { AssignableUser } from './row-actions';
import { useConfigFile } from './use-config-file';

export function GenerateConfigDialog({
  nodes,
  users = [],
  triggerLabel = 'Generate config',
}: {
  nodes: { id: string; name: string; region: string }[];
  users?: AssignableUser[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [choice, setChoice] = React.useState(emptyChoice(SPARE));
  const file = useConfigFile();

  // A plain handler rather than useActionState + an effect: setState inside an effect triggers
  // cascading renders, and preventDefault keeps the typed values through a failed submit.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { assignee, problem } = readChoice(choice);
    if (problem) {
      toast.error(problem);
      return;
    }
    const formData = new FormData(event.currentTarget);
    const deviceLabel = String(formData.get('deviceLabel') ?? '').trim();
    startTransition(async () => {
      const result = await generateConfigAction({
        nodeId: String(formData.get('nodeId') ?? ''),
        deviceLabel,
        assignee,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setError(null);
      setChoice(emptyChoice(SPARE));
      setOpen(false);
      // A live config is about to be handed over, so its file comes straight up. A spare's does
      // not: a retrieval is recorded as a delivery, and nobody holds the spare yet.
      if (result.liveConfigId) file.show(result.liveConfigId, deviceLabel || 'the new tunnel');
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="h-8">
            <Plus className="size-4" />
            {triggerLabel}
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate config</DialogTitle>
            <DialogDescription>
              Reserves a keypair and an address. Assign it now and the tunnel goes live; leave it
              unassigned and it waits as a spare.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nodeId" className="text-sm">
                Node
              </Label>
              <Select name="nodeId" defaultValue={nodes[0]?.id}>
                <SelectTrigger id="nodeId" className="h-8 w-full bg-background">
                  <SelectValue placeholder="Choose a node" />
                </SelectTrigger>
                <SelectContent>
                  {nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name} · {node.region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="deviceLabel" className="text-sm">
                  Device
                </Label>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                  optional
                </span>
              </div>
              <Input
                id="deviceLabel"
                name="deviceLabel"
                placeholder="Phone"
                className="h-8 bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Each device needs its own config — one key cannot be shared across two.
              </p>
            </div>

            <AssigneeField
              id={`assignee-${nodes[0]?.id ?? 'new'}`}
              users={users}
              value={choice}
              onChange={setChoice}
              allowSpare
            />

            <DialogFooter className="items-center gap-3 sm:justify-between">
              <p role={error ? 'alert' : undefined} className="text-xs text-destructive">
                {error}
              </p>
              <Button type="submit" size="sm" className="h-8">
                {pending ? 'Generating…' : isAssigning(choice) ? 'Generate and Assign' : 'Generate config'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfigFileDialog {...file.dialogProps} />
    </>
  );
}

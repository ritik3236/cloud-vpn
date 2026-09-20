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

export function GenerateConfigDialog({
  nodes,
  triggerLabel = 'Generate config',
}: {
  nodes: { id: string; name: string; region: string }[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // A plain handler rather than useActionState + an effect: setState inside an effect triggers
  // cascading renders, and preventDefault keeps the typed values through a failed submit.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await generateConfigAction(null, formData);
      if (result.ok) {
        toast.success(result.message);
        setError(null);
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  };

  return (
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
            Reserves a keypair and an address. Nothing is live until you assign it to someone.
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

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <p role={error ? 'alert' : undefined} className="text-xs text-destructive">
              {error}
            </p>
            <Button type="submit" size="sm" className="h-8">
              {pending ? 'Generating…' : 'Generate config'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

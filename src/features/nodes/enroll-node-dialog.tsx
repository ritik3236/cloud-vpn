'use client';

import { Plus, Terminal } from 'lucide-react';
import * as React from 'react';

import { Copyable } from '@/design-system';
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

import { createEnrollmentTokenAction } from './actions';

function Field({ name, label, example, hint }: { name: string; label: string; example: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-sm">
        {label}
      </Label>
      <Input id={name} name={name} placeholder={example} className="h-8 bg-background" />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EnrollNodeDialog({ serverUrl }: { serverUrl: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [command, setCommand] = React.useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createEnrollmentTokenAction(formData);
      if (result.ok) {
        setError(null);
        setCommand(
          `curl -fsSL ${serverUrl}/install.sh | sudo sh -s -- --token=${result.token} --server=${serverUrl}`,
        );
      } else {
        setError(result.error);
      }
    });
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCommand(null);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8">
          <Plus className="size-4" />
          Add node
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        {command ? (
          <>
            <DialogHeader>
              <DialogTitle>Run this on the new server</DialogTitle>
              <DialogDescription>
                It installs WireGuard and the agent, then registers the node itself. The node
                appears here when it finishes — nothing to copy back.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Terminal className="size-3.5" />
                <span>As root, on the new server</span>
              </div>
              <Copyable
                value={command}
                display={command}
                label="install command"
                className="w-full items-start whitespace-pre-wrap break-all text-left"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              The token works once and expires in an hour. Open the WireGuard UDP port to the
              world, and the agent port to this control plane only.
            </p>

            <DialogFooter>
              <Button size="sm" className="h-8" onClick={() => close(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add node</DialogTitle>
              <DialogDescription>
                Name the node and we will give you one command to run on it. The server generates
                its own keys and certificate.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field name="name" label="Name" example="VPN-2" />
              <div className="grid grid-cols-2 gap-3">
                <Field name="region" label="Region" example="Stockholm" />
                <Field name="provider" label="Provider" example="njal.la" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  name="cidrPool"
                  label="Address pool"
                  example="10.8.1.0/24"
                  hint="A /24 holds 253 clients."
                />
                <Field name="dns" label="DNS" example="1.1.1.1" hint="Given to clients." />
              </div>

              <DialogFooter className="items-center gap-3 sm:justify-between">
                <p role={error ? 'alert' : undefined} className="text-xs text-destructive">
                  {error}
                </p>
                <Button type="submit" size="sm" className="h-8">
                  {pending ? 'Generating…' : 'Get install command'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

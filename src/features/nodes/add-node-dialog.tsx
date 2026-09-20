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
import { Textarea } from '@/design-system/ui/textarea';
import { cn } from '@/lib/cn';

import { addNodeAction } from './actions';

/** A small uppercase eyebrow, not a bare divider — the group has a name. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  name,
  label,
  hint,
  example,
  secret,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  example?: string;
  secret?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={name} className="text-sm">
          {label}
        </Label>
        {secret ? (
          <span className="rounded-full bg-secret-bg px-1.5 py-0.5 text-[0.625rem] font-medium text-secret">
            encrypted at rest
          </span>
        ) : null}
      </div>
      {children ?? (
        // shadcn inputs are bg-transparent and would sink into the recessed body; give them
        // the base surface explicitly so the controls float above the well.
        <Input id={name} name={name} placeholder={example} className="h-8 bg-background" />
      )}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AddNodeDialog() {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // A plain handler rather than useActionState + an effect: setState inside an effect triggers
  // cascading renders, and preventDefault keeps the typed values through a failed submit.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await addNodeAction(null, formData);
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
          Add node
        </Button>
      </DialogTrigger>

      {/* Header and footer are pinned; only the fields scroll, so the primary action never
          leaves the screen on a short viewport. */}
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Add node</DialogTitle>
          <DialogDescription>
            The agent must already be running. We check it answers, routes traffic, and matches
            its certificate before saving.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-muted/40 px-6 py-5">
            <Section title="Identity">
              <Field name="name" label="Name" example="VPN-1" />
              <div className="grid grid-cols-2 gap-3">
                <Field name="region" label="Region" example="Singapore" />
                <Field name="provider" label="Provider" example="njal.la" />
              </div>
            </Section>

            <Section title="Network">
              <Field
                name="endpoint"
                label="WireGuard endpoint"
                example="80.78.31.19:51820"
                hint="Host and UDP port clients connect to."
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  name="cidrPool"
                  label="Address pool"
                  example="10.8.0.0/24"
                  hint="A /24 holds 253 clients."
                />
                <Field name="dns" label="DNS" example="1.1.1.1" />
              </div>
            </Section>

            <Section title="Agent">
              <Field
                name="agentUrl"
                label="Agent URL"
                example="https://80.78.31.19:51821"
                hint="Must be https — the token travels on every call."
              />
              <Field name="agentToken" label="Agent token" secret />
              <Field name="agentCert" label="Agent certificate" secret>
                <Textarea
                  id="agentCert"
                  name="agentCert"
                  rows={4}
                  placeholder="-----BEGIN CERTIFICATE-----"
                  className="bg-background font-mono text-xs"
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Copy both from the node over SSH. Carrying them out of band is what stops an
                impostor answering on the node&apos;s behalf.
              </p>
            </Section>
          </div>

          <DialogFooter className="items-center gap-3 border-t border-border px-6 py-4 sm:justify-between">
            <p
              role={error ? 'alert' : undefined}
              className={cn(
                'text-xs',
                error ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {error ?? 'The node is verified before it is saved.'}
            </p>
            {/* Never disabled to express validation — it stays clickable and says what is wrong. */}
            <Button type="submit" size="sm" className="h-8">
              {pending ? 'Checking node…' : 'Add node'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

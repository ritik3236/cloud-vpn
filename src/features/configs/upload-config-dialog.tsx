'use client';

import { Upload } from 'lucide-react';
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

import { uploadExternalConfigAction } from './actions';

export function UploadConfigDialog({ sources }: { sources: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await uploadExternalConfigAction(null, formData);
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
        <Button variant="outline" size="sm" className="h-8">
          <Upload className="size-4" />
          Add external config
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add external config</DialogTitle>
          <DialogDescription>
            For providers we cannot control, like Proton. The file is stored encrypted and
            assigned like any other config — but we can never revoke it on their side.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sourceName" className="text-sm">
                Provider
              </Label>
              <Input
                id="sourceName"
                name="sourceName"
                list="external-sources"
                defaultValue={sources[0]?.name ?? ''}
                placeholder="Proton"
                className="h-8 bg-background"
              />
              <datalist id="external-sources">
                {sources.map((source) => (
                  <option key={source.id} value={source.name} />
                ))}
              </datalist>
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
              <Input id="deviceLabel" name="deviceLabel" placeholder="Phone" className="h-8 bg-background" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="conf" className="text-sm">
                Configuration file
              </Label>
              <span className="rounded-full bg-secret-bg px-1.5 py-0.5 text-[0.625rem] font-medium text-secret">
                encrypted at rest
              </span>
            </div>
            <Textarea
              id="conf"
              name="conf"
              rows={9}
              placeholder={'[Interface]\nPrivateKey = …\nAddress = 10.2.0.2/32\n\n[Peer]\nPublicKey = …\nEndpoint = …'}
              className="bg-background font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Paste the whole file. It is stored exactly as given and handed back unchanged.
            </p>
          </div>

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <p role={error ? 'alert' : undefined} className="text-xs text-destructive">
              {error}
            </p>
            <Button type="submit" size="sm" className="h-8">
              {pending ? 'Storing…' : 'Store config'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

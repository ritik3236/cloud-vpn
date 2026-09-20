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

import { addUserAction } from './actions';

export function AddUserDialog() {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await addUserAction(null, formData);
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
          Add user
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Creates someone a config can be assigned to. It does not send an invite or grant
            sign-in yet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="asha@example.com"
              className="h-8 bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="name" className="text-sm">
                Name
              </Label>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                optional
              </span>
            </div>
            <Input id="name" name="name" placeholder="Asha Menon" className="h-8 bg-background" />
            <p className="text-xs text-muted-foreground">
              Shown instead of the email wherever their configs appear.
            </p>
          </div>

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <p role={error ? 'alert' : undefined} className="text-xs text-destructive">
              {error}
            </p>
            <Button type="submit" size="sm" className="h-8">
              {pending ? 'Adding…' : 'Add user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

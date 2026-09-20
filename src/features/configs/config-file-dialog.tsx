'use client';

import { Download, ShieldAlert } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Copyable } from '@/design-system';
import { Button } from '@/design-system/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design-system/ui/dialog';

import type { RetrieveResult } from './actions';

export function ConfigFileDialog({
  open,
  onOpenChange,
  label,
  result,
  pending,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  result: RetrieveResult | null;
  pending: boolean;
  /** The warning differs by audience: an admin is forwarding a key, a user is receiving one. */
  note?: string;
}) {
  const download = () => {
    if (!result?.ok) return;
    const url = URL.createObjectURL(new Blob([result.content], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.filename;
    anchor.click();
    // Deferred: revoking in the same tick can beat the browser starting the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${result.filename} downloaded.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Config for {label}</DialogTitle>
          <DialogDescription>
            Scan on a phone, or download the file for a desktop client.
          </DialogDescription>
        </DialogHeader>

        {pending ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
            Building the config…
          </div>
        ) : result?.ok ? (
          <div className="space-y-4">
            {/* The QR sits on its own white panel regardless of palette — scanners need the
                contrast, and this is the one place a literal colour is correct. */}
            <div
              className="mx-auto w-fit rounded-lg bg-white p-3 [&>svg]:block [&>svg]:size-60"
              dangerouslySetInnerHTML={{ __html: result.qrSvg }}
              role="img"
              aria-label={`WireGuard configuration QR code for ${label}`}
            />

            <div className="flex items-start gap-2 rounded-md bg-secret-bg px-3 py-2 text-secret">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-xs">
                {note ??
                  'This contains the private key. Every retrieval is recorded in the audit log, and you can get it again later — so send it over something you trust rather than keeping a copy.'}
              </p>
            </div>

            <Copyable
              value={result.content}
              display={result.filename}
              label="configuration file"
              className="w-full"
            />
          </div>
        ) : (
          <p role="alert" className="py-6 text-center text-sm text-destructive">
            {result?.error ?? 'Could not build the config.'}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" size="sm" className="h-8" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" className="h-8" disabled={!result?.ok} onClick={download}>
            <Download className="size-4" />
            Download .conf
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

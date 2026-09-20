'use client';

import * as React from 'react';

import { Button } from '@/design-system/ui/button';
import { ConfigFileDialog } from '@/features/configs/config-file-dialog';
import type { RetrieveResult } from '@/features/configs/actions';

/** Fixture gallery only: the real dialog, fed a sample config instead of a server action. */
export function ConfigDialogDemo({ result }: { result: RetrieveResult }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(true)}>
        Show config dialog
      </Button>
      <ConfigFileDialog
        open={open}
        onOpenChange={setOpen}
        label="Phone"
        result={result}
        pending={false}
      />
    </>
  );
}

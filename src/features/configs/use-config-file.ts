'use client';

import * as React from 'react';

import { retrieveConfigAction, type RetrieveResult } from './actions';

/** Opens a config's file (QR, copy, download) and fetches it — one flow for every place that does. */
export function useConfigFile() {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [result, setResult] = React.useState<RetrieveResult | null>(null);
  const [pending, startFetch] = React.useTransition();

  const show = (configId: string, forLabel: string) => {
    setResult(null);
    setLabel(forLabel);
    setOpen(true);
    startFetch(async () => setResult(await retrieveConfigAction(configId)));
  };

  return { show, dialogProps: { open, onOpenChange: setOpen, label, result, pending } };
}

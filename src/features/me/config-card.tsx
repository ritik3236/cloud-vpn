'use client';

import { Download, Globe, Server } from 'lucide-react';
import * as React from 'react';

import { CONFIG_STATUS_LABEL, configTone, StatusPill } from '@/design-system';
import type { Connection } from '@/lib/connection';
import { Button } from '@/design-system/ui/button';
import { ConfigFileDialog } from '@/features/configs/config-file-dialog';
import { ConnectionLine } from '@/features/configs/connection-line';
import type { RetrieveResult } from '@/features/configs/actions';

import { retrieveOwnConfigAction } from './actions';

export type MyConfig = {
  id: string;
  status: string;
  deviceLabel: string | null;
  assignedIp: string | null;
  sourceType: string;
  node: { name: string; region: string } | null;
  externalSource: { name: string } | null;
  connection: Connection;
};

export function ConfigCard({ config }: { config: MyConfig }) {
  const [open, setOpen] = React.useState(false);
  const [result, setResult] = React.useState<RetrieveResult | null>(null);
  const [pending, startTransition] = React.useTransition();

  const external = config.sourceType === 'static';
  const where = external
    ? (config.externalSource?.name ?? 'External provider')
    : `${config.node?.name ?? 'Unknown'} · ${config.node?.region ?? ''}`;
  const name = config.deviceLabel ?? 'Your device';
  const usable = config.status === 'active';

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-medium">{name}</h2>
              <StatusPill tone={configTone(config.status)}>
                {CONFIG_STATUS_LABEL[config.status] ?? config.status}
              </StatusPill>
            </div>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {external ? <Globe className="size-3.5" /> : <Server className="size-3.5" />}
              {where}
              {config.assignedIp ? ` · ${config.assignedIp}` : ''}
            </p>
            <div className="mt-1.5">
              <ConnectionLine
                connection={config.connection}
                provider={config.externalSource?.name}
                verbose
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          {usable ? (
            <Button
              size="sm"
              className="h-8 w-full"
              onClick={() => {
                setResult(null);
                setOpen(true);
                startTransition(async () => setResult(await retrieveOwnConfigAction(config.id)));
              }}
            >
              <Download className="size-4" />
              Get config
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              This connection is paused. An admin can switch it back on.
            </p>
          )}
        </div>
      </div>

      <ConfigFileDialog
        open={open}
        onOpenChange={setOpen}
        label={name}
        result={result}
        pending={pending}
        note="This file is the key to your VPN — anyone who has it can connect as you. Import it into WireGuard, then delete the download."
      />
    </>
  );
}

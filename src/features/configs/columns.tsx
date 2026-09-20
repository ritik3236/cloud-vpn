import {
  CONFIG_STATUS_LABEL,
  configTone,
  Copyable,
  StatusPill,
  type Column,
} from '@/design-system';
import { formatDateTime, relativeTime, truncateId } from '@/lib/format';

import { ConfigRowActions } from './row-actions';

export type ConfigRow = {
  id: string;
  status: string;
  deviceLabel: string | null;
  assignedIp: string | null;
  pubkey: string | null;
  createdAt: Date;
  node: { name: string } | null;
  user: { name: string | null; email: string } | null;
};

const holderOf = (config: ConfigRow) => config.user?.name ?? config.user?.email ?? null;

export const configColumns: Column<ConfigRow>[] = [
  {
    key: 'holder',
    header: 'Assigned to',
    cell: (config) => {
      const holder = holderOf(config);
      return (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {holder ?? <span className="text-muted-foreground">Unassigned</span>}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {config.deviceLabel ?? 'No device label'}
          </div>
        </div>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    cell: (config) => (
      <StatusPill tone={configTone(config.status)}>
        {CONFIG_STATUS_LABEL[config.status] ?? config.status}
      </StatusPill>
    ),
  },
  { key: 'node', header: 'Node', cell: (config) => <span className="text-sm">{config.node?.name ?? '—'}</span> },
  {
    key: 'address',
    header: 'Address',
    cell: (config) =>
      config.assignedIp ? <span className="font-mono text-xs">{config.assignedIp}</span> : '—',
  },
  {
    key: 'pubkey',
    header: 'Public key',
    cell: (config) =>
      config.pubkey ? (
        <Copyable value={config.pubkey} display={truncateId(config.pubkey)} label="public key" />
      ) : (
        '—'
      ),
  },
  {
    key: 'created',
    header: 'Created',
    cell: (config) => (
      <span className="text-xs text-muted-foreground" title={formatDateTime(config.createdAt)}>
        {relativeTime(config.createdAt)}
      </span>
    ),
  },
  {
    key: 'actions',
    header: '',
    headClassName: 'w-10',
    cell: (config) => (
      <div className="flex justify-end">
        <ConfigRowActions
          config={{
            id: config.id,
            status: config.status,
            assignedIp: config.assignedIp,
            deviceLabel: config.deviceLabel,
            userLabel: holderOf(config),
          }}
        />
      </div>
    ),
  },
];

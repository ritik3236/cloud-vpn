import {
  CONFIG_STATUS_LABEL,
  configTone,
  Copyable,
  StatusPill,
  type Column,
} from '@/design-system';
import { formatDateTime, relativeTime, truncateId } from '@/lib/format';
import { personLabel } from '@/lib/person';

import type { Connection } from '@/lib/connection';

import { ConnectionLine } from './connection-line';
import { ConfigRowActions, type AssignableUser } from './row-actions';

export type ConfigRow = {
  id: string;
  status: string;
  deviceLabel: string | null;
  assignedIp: string | null;
  pubkey: string | null;
  createdAt: Date;
  sourceType: string;
  node: { name: string; region: string; endpoint: string } | null;
  externalSource: { name: string } | null;
  user: { name: string | null; username: string | null; email: string | null } | null;
  /** Live, read from the node at render — never stored beside `status`. */
  connection?: Connection;
};

const holderOf = (config: ConfigRow) => (config.user ? personLabel(config.user) : null);

/** Columns are a function of the assignable users, so the row menu can offer them. */
export const configColumns = (
  users: AssignableUser[],
  canRetrieve = false,
): Column<ConfigRow>[] => [
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
      <div className="space-y-1">
        <StatusPill tone={configTone(config.status)}>
          {CONFIG_STATUS_LABEL[config.status] ?? config.status}
        </StatusPill>
        {config.connection ? (
          <ConnectionLine connection={config.connection} provider={config.externalSource?.name} />
        ) : null}
      </div>
    ),
  },
  {
    key: 'node',
    header: 'Source',
    cell: (config) =>
      // An external config has no node — it belongs to a provider we do not run.
      config.sourceType === 'static' ? (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{config.externalSource?.name ?? 'External'}</div>
          <div className="truncate text-xs text-muted-foreground">Not managed by us</div>
        </div>
      ) : config.node ? (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{config.node.name}</div>
          {/* Where the tunnel actually terminates. The port is noise in a dense row, so the
              full host:port stays one hover away. */}
          <div className="truncate text-xs text-muted-foreground" title={config.node.endpoint}>
            {config.node.region} · {config.node.endpoint.split(':')[0]}
          </div>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
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
          users={users}
          canRetrieve={canRetrieve}
          config={{
            id: config.id,
            status: config.status,
            assignedIp: config.assignedIp,
            deviceLabel: config.deviceLabel,
            userLabel: holderOf(config),
            sourceType: config.sourceType === 'static' ? 'static' : 'managed',
            sourceName: config.externalSource?.name ?? null,
          }}
        />
      </div>
    ),
  },
];


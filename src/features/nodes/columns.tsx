import { Copyable, NODE_STATUS_LABEL, nodeTone, StatusPill, type Column } from '@/design-system';
import { formatDateTime, formatNumber, relativeTime, truncateId } from '@/lib/format';

export type NodeRow = {
  id: string;
  name: string;
  region: string;
  provider: string;
  status: string;
  endpoint: string;
  cidrPool: string;
  nodePubkey: string;
  createdAt: Date;
  _count: { configs: number };
};

export const nodeColumns: Column<NodeRow>[] = [
  {
    key: 'name',
    header: 'Node',
    cell: (node) => (
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{node.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {node.region} · {node.provider}
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (node) => (
      <StatusPill tone={nodeTone(node.status)}>
        {NODE_STATUS_LABEL[node.status] ?? node.status}
      </StatusPill>
    ),
  },
  {
    key: 'endpoint',
    header: 'Endpoint',
    cell: (node) => <Copyable value={node.endpoint} label="endpoint" />,
  },
  {
    key: 'pubkey',
    header: 'Public key',
    cell: (node) => (
      <Copyable
        value={node.nodePubkey}
        display={truncateId(node.nodePubkey)}
        label="node public key"
      />
    ),
  },
  { key: 'pool', header: 'Pool', cell: (node) => <span className="font-mono text-xs">{node.cidrPool}</span> },
  {
    key: 'configs',
    header: 'Configs',
    numeric: true,
    cell: (node) => <span className="text-sm">{formatNumber(node._count.configs)}</span>,
  },
  {
    key: 'added',
    header: 'Added',
    cell: (node) => (
      <span className="text-xs text-muted-foreground" title={formatDateTime(node.createdAt)}>
        {relativeTime(node.createdAt)}
      </span>
    ),
  },
];

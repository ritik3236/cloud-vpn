import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireRole } from '@/auth/roles';
import {
  CONFIG_STATUS_LABEL,
  configTone,
  DataTable,
  EmptyState,
  StatCard,
  StatusPill,
  type Column,
} from '@/design-system';
import { Button } from '@/design-system/ui/button';
import { ConfigRowActions } from '@/features/configs/row-actions';
import { UserRowActions } from '@/features/users/row-actions';
import { formatBytes, formatDate, formatDateTime, formatNumber, relativeTime, truncateId } from '@/lib/format';
import { db } from '@/server/db';
import { usageByConfig, type ConfigUsage } from '@/server/usage';

type Row = {
  id: string;
  status: string;
  deviceLabel: string | null;
  assignedIp: string | null;
  pubkey: string | null;
  createdAt: Date;
  sourceType: string;
  node: { name: string; region: string; endpoint: string } | null;
  externalSource: { name: string } | null;
  usage?: ConfigUsage;
  /** The node could not be reached, so usage is unknown rather than zero. */
  usageUnavailable: boolean;
};

const columns = (userLabel: string, canManage: boolean): Column<Row>[] => [
  {
    key: 'device',
    header: 'Device',
    cell: (row) => (
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{row.deviceLabel ?? 'Unlabelled'}</div>
        <div className="truncate text-xs text-muted-foreground" title={row.pubkey ?? undefined}>
          {row.pubkey ? truncateId(row.pubkey, 10, 6) : '—'}
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => (
      <StatusPill tone={configTone(row.status)}>
        {CONFIG_STATUS_LABEL[row.status] ?? row.status}
      </StatusPill>
    ),
  },
  {
    key: 'node',
    header: 'Source',
    cell: (row) =>
      row.sourceType === 'static' ? (
        <div className="min-w-0">
          <div className="truncate text-sm">{row.externalSource?.name ?? 'External'}</div>
          <div className="truncate text-xs text-muted-foreground">Not managed by us</div>
        </div>
      ) : row.node ? (
        <div className="min-w-0">
          <div className="truncate text-sm">{row.node.name}</div>
          <div className="truncate text-xs text-muted-foreground" title={row.node.endpoint}>
            {row.node.region} · {row.node.endpoint.split(':')[0]}
          </div>
        </div>
      ) : (
        '—'
      ),
  },
  {
    key: 'address',
    header: 'Address',
    cell: (row) => (row.assignedIp ? <span className="font-mono text-xs">{row.assignedIp}</span> : '—'),
  },
  {
    key: 'seen',
    header: 'Last seen',
    cell: (row) => {
      if (row.usageUnavailable) {
        return <span className="text-xs text-muted-foreground">Node unreachable</span>;
      }
      if (!row.usage?.lastHandshake) {
        return <span className="text-xs text-muted-foreground">Never connected</span>;
      }
      return (
        <span
          className="text-xs text-muted-foreground"
          title={formatDateTime(new Date(row.usage.lastHandshake * 1000))}
        >
          {relativeTime(row.usage.lastHandshake)}
        </span>
      );
    },
  },
  {
    key: 'transfer',
    header: 'Transferred',
    numeric: true,
    cell: (row) =>
      row.usage ? (
        <span className="text-sm" title={`${formatBytes(row.usage.rxBytes)} in · ${formatBytes(row.usage.txBytes)} out`}>
          {formatBytes(row.usage.rxBytes + row.usage.txBytes)}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: 'actions',
    header: '',
    headClassName: 'w-10',
    cell: (row) =>
      canManage ? (
        <div className="flex justify-end">
          <ConfigRowActions
            users={[]}
            canRetrieve={canManage}
            config={{
              id: row.id,
              status: row.status,
              assignedIp: row.assignedIp,
              deviceLabel: row.deviceLabel,
              userLabel,
              sourceType: row.sourceType === 'static' ? 'static' : 'managed',
              sourceName: row.externalSource?.name ?? null,
            }}
          />
        </div>
      ) : null,
  },
];

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { role } = await requireRole('admin', 'ops');
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      configs: {
        orderBy: { createdAt: 'desc' },
        include: {
          node: { select: { name: true, region: true, endpoint: true } },
          externalSource: { select: { name: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const label = user.name ?? user.email;
  const usage = await usageByConfig(user.configs);
  const reachableNodes = new Set([...usage.keys()]);

  const rows: Row[] = user.configs.map((config) => ({
    ...config,
    usage: usage.get(config.id),
    // A live config with no reading means its node did not answer — distinct from a config
    // that has simply never been used.
    usageUnavailable: config.status === 'active' && !reachableNodes.has(config.id),
  }));

  const live = user.configs.filter((config) => config.status === 'active').length;
  const transferred = [...usage.values()].reduce((sum, u) => sum + u.rxBytes + u.txBytes, 0);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground">
        <Link href="/dashboard/users">
          <ArrowLeft className="size-4" />
          All users
        </Link>
      </Button>

      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold tracking-tight">{label}</h1>
            <StatusPill tone={user.status === 'active' ? 'live' : 'paused'}>
              {user.status === 'active' ? 'Active' : 'Suspended'}
            </StatusPill>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {user.email} · added {formatDate(user.createdAt)}
          </p>
        </div>
        {role === 'admin' ? (
          <UserRowActions
            user={{ id: user.id, label, status: user.status, liveConfigs: live }}
          />
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Live tunnels"
          value={formatNumber(live)}
          hint={`${formatNumber(user.configs.length)} configs total`}
          tone={live > 0 ? 'live' : 'idle'}
        />
        <StatCard
          label="Transferred"
          value={formatBytes(transferred)}
          hint="Live counters, not stored history"
        />
        <StatCard
          label="Devices"
          value={formatNumber(new Set(user.configs.map((c) => c.deviceLabel ?? c.id)).size)}
          hint="One config per device"
        />
      </div>

      {user.configs.length === 0 ? (
        <EmptyState
          title={`${label} has no configs`}
          hint="Generate a spare on a node, then assign it from the configs page."
          action={
            <Button asChild size="sm" className="h-8">
              <Link href="/dashboard/configs">Go to configs</Link>
            </Button>
          }
        />
      ) : (
        <>
          <DataTable columns={columns(label, role === 'admin')} rows={rows} rowKey={(row) => row.id} />
          <p className="text-xs text-muted-foreground">
            Transfer and last-seen are read live from each node. WireGuard counts per peer, so a
            figure resets when a config is disabled and re-enabled.
          </p>
        </>
      )}
    </div>
  );
}

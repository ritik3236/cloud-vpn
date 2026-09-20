import Link from 'next/link';

import { requireRole } from '@/auth/roles';
import { EmptyState, PageHeader, StatCard } from '@/design-system';
import { Button } from '@/design-system/ui/button';
import { formatDateTime, formatNumber, pluralise, relativeTime } from '@/lib/format';
import { db } from '@/server/db';
import { poolRange } from '@/server/ipam';

const ACTION_LABEL: Record<string, string> = {
  'config.generate': 'generated a config',
  'config.assign': 'assigned a config',
  'config.unassign': 'returned a config to the pool',
  'config.view': 'retrieved a config',
  'config.disable': 'disabled a tunnel',
  'config.enable': 're-enabled a tunnel',
  'config.revoke': 'revoked a config',
  'config.reassign': 'reassigned a config',
  'node.create': 'added a node',
  'node.delete': 'removed a node',
};

export default async function OverviewPage() {
  await requireRole('admin', 'ops');

  const [nodes, configCounts, userCount, liveAllocations, recent] = await Promise.all([
    db.node.findMany({ select: { id: true, status: true, cidrPool: true } }),
    db.config.groupBy({ by: ['status'], _count: { _all: true } }),
    db.user.count(),
    db.ipAllocation.count({ where: { releasedAt: null } }),
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);

  const count = (status: string) =>
    configCounts.find((row) => row.status === status)?._count._all ?? 0;

  const online = nodes.filter((node) => node.status === 'active');
  const capacity = online.reduce((total, node) => {
    try {
      const { first, last } = poolRange(node.cidrPool);
      return total + (last - first + 1);
    } catch {
      return total;
    }
  }, 0);

  const totalConfigs = configCounts.reduce((sum, row) => sum + row._count._all, 0);
  const used = capacity === 0 ? 0 : Math.round((liveAllocations / capacity) * 100);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Fleet health at a glance." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Nodes online"
          value={`${formatNumber(online.length)} / ${formatNumber(nodes.length)}`}
          hint={nodes.length === 0 ? 'None registered yet' : `${pluralise(nodes.length, 'node')} registered`}
          tone={nodes.length === 0 ? 'idle' : online.length === nodes.length ? 'live' : 'paused'}
        />
        <StatCard
          label="Live tunnels"
          value={formatNumber(count('active'))}
          hint={`${formatNumber(count('disabled'))} disabled`}
          tone={count('active') > 0 ? 'live' : 'idle'}
        />
        <StatCard
          label="Spare configs"
          value={formatNumber(count('unassigned'))}
          hint="Generated, not yet assigned"
          tone="idle"
        />
        <StatCard
          label="Address use"
          value={capacity === 0 ? '—' : `${used}%`}
          hint={
            capacity === 0
              ? 'No pools yet'
              : `${formatNumber(liveAllocations)} of ${formatNumber(capacity)} addresses`
          }
          tone={used > 85 ? 'dead' : used > 60 ? 'paused' : 'live'}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Users" value={formatNumber(userCount)} hint="People who can hold configs" />
        <StatCard label="Configs issued" value={formatNumber(totalConfigs)} hint="All time, any status" />
        <StatCard
          label="Revoked"
          value={formatNumber(count('revoked'))}
          hint="Addresses returned to the pool"
          tone={count('revoked') > 0 ? 'dead' : 'idle'}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link href="/dashboard/audit">View audit log</Link>
          </Button>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="Nothing has happened yet"
            hint="Add a node, then generate your first config."
            action={
              <Button asChild size="sm" className="h-8">
                <Link href="/dashboard/nodes">Go to nodes</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    Someone {ACTION_LABEL[entry.action] ?? entry.action}
                  </p>
                  {entry.target ? (
                    <p className="truncate font-mono text-xs text-muted-foreground">{entry.target}</p>
                  ) : null}
                </div>
                <span
                  className="shrink-0 text-xs text-muted-foreground"
                  title={formatDateTime(entry.createdAt)}
                >
                  {relativeTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { requireRole } from '@/auth/roles';
import { Copyable, DataTable, EmptyState, PageHeader, StatusPill, type Column } from '@/design-system';
import { formatDateTime, pluralise, relativeTime, truncateId } from '@/lib/format';
import { db } from '@/server/db';

type AuditRow = {
  id: string;
  actorId: string | null;
  action: string;
  target: string | null;
  createdAt: Date;
};

const TONE: Record<string, 'live' | 'idle' | 'paused' | 'dead'> = {
  'config.generate': 'idle',
  'config.assign': 'live',
  'config.enable': 'live',
  'config.view': 'idle',
  'config.unassign': 'paused',
  'config.disable': 'paused',
  'config.revoke': 'dead',
  'config.reassign': 'paused',
  'node.create': 'live',
  'node.delete': 'dead',
};

const columns: Column<AuditRow>[] = [
  {
    key: 'action',
    header: 'Action',
    cell: (entry) => (
      <StatusPill tone={TONE[entry.action] ?? 'idle'}>{entry.action}</StatusPill>
    ),
  },
  {
    key: 'target',
    header: 'Target',
    cell: (entry) =>
      entry.target ? (
        <Copyable value={entry.target} display={truncateId(entry.target, 10, 6)} label="target id" />
      ) : (
        '—'
      ),
  },
  {
    key: 'actor',
    header: 'Actor',
    cell: (entry) =>
      entry.actorId ? (
        <Copyable value={entry.actorId} display={truncateId(entry.actorId, 10, 4)} label="actor id" />
      ) : (
        <span className="text-xs text-muted-foreground">system</span>
      ),
  },
  {
    key: 'when',
    header: 'When',
    cell: (entry) => (
      <span className="text-xs text-muted-foreground" title={formatDateTime(entry.createdAt)}>
        {relativeTime(entry.createdAt)}
      </span>
    ),
  },
];

export default async function AuditPage() {
  await requireRole('admin', 'ops');

  const entries = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description={
          entries.length
            ? `Last ${pluralise(entries.length, 'entry', 'entries')}. Every issue, retrieval and revocation is recorded.`
            : 'Every issue, retrieval and revocation is recorded here.'
        }
      />

      {entries.length === 0 ? (
        <EmptyState title="No activity yet" hint="Actions taken in the dashboard will appear here." />
      ) : (
        <DataTable columns={columns} rows={entries} rowKey={(entry) => entry.id} />
      )}
    </div>
  );
}

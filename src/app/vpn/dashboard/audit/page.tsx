import { requireRole } from '@/auth/roles';
import { DataTable, EmptyState, PageHeader } from '@/design-system';
import { auditColumns, type AuditRow } from '@/features/audit/columns';
import { pluralise } from '@/lib/format';
import { personLabel } from '@/lib/person';
import { db } from '@/server/db';

export default async function AuditPage() {
  await requireRole('admin', 'ops');

  const entries = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });

  const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];
  const targetsOf = (prefix: string) =>
    unique(entries.filter((entry) => entry.action.startsWith(prefix)).map((entry) => entry.target));

  // Four lookups for the whole page, however many rows there are.
  const [actors, configs, nodes, people] = await Promise.all([
    db.user.findMany({
      where: { clerkId: { in: unique(entries.map((entry) => entry.actorId)) } },
      select: { clerkId: true, name: true, username: true, email: true },
    }),
    db.config.findMany({
      where: { id: { in: targetsOf('config.') } },
      select: { id: true, assignedIp: true, deviceLabel: true },
    }),
    db.node.findMany({ where: { id: { in: targetsOf('node.') } }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { id: { in: targetsOf('user.') } },
      select: { id: true, name: true, username: true, email: true },
    }),
  ]);

  const actorLabels = new Map(actors.map((actor) => [actor.clerkId, personLabel(actor)]));
  const targetLabels = new Map<string, string>();
  for (const config of configs) {
    // A revoked config has given its address back, so the device label may be all that is left.
    const label = [config.assignedIp, config.deviceLabel].filter(Boolean).join(' · ');
    if (label) targetLabels.set(config.id, label);
  }
  for (const node of nodes) targetLabels.set(node.id, node.name);
  for (const person of people) targetLabels.set(person.id, personLabel(person));

  const rows: AuditRow[] = entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    createdAt: entry.createdAt,
    target: entry.target ? { id: entry.target, label: targetLabels.get(entry.target) ?? null } : null,
    actor: entry.actorId
      ? { id: entry.actorId, label: actorLabels.get(entry.actorId) ?? null }
      : null,
  }));

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
        <>
          <DataTable columns={auditColumns} rows={rows} rowKey={(entry) => entry.id} />
          <p className="text-xs text-muted-foreground">
            Names are resolved when the log is read, so they follow a rename. An entry with only
            an id points at something that has since been deleted — the record stays either way.
          </p>
        </>
      )}
    </div>
  );
}

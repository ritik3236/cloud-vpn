import { requireRole } from '@/auth/roles';
import { DataTable, EmptyState, PageHeader } from '@/design-system';
import { configColumns } from '@/features/configs/columns';
import { GenerateConfigDialog } from '@/features/configs/generate-config-dialog';
import { UploadConfigDialog } from '@/features/configs/upload-config-dialog';
import { connectionOf } from '@/lib/connection';
import { pluralise } from '@/lib/format';
import { personLabel } from '@/lib/person';
import { db } from '@/server/db';
import { listExternalSources } from '@/server/external';
import { usageByConfig } from '@/server/usage';
import { syncUsersFromClerk } from '@/server/users';

export default async function ConfigsPage() {
  const { role } = await requireRole('admin', 'ops');
  const canGenerate = role === 'admin';

  const [clerkPeople, configs, nodes, sources] = await Promise.all([
    syncUsersFromClerk(),
    db.config.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        node: { select: { name: true, region: true, endpoint: true } },
        externalSource: { select: { name: true } },
        user: { select: { name: true, username: true, email: true } },
      },
    }),
    db.node.findMany({ where: { status: 'active' }, select: { id: true, name: true, region: true } }),
    listExternalSources(),
  ]);

  // Only active people who exist in Clerk can receive a config: suspending someone is meant to
  // stop access, and a row with no Clerk account behind it is nobody who can sign in and use one.
  // If Clerk is unreachable we fall back to every linked row rather than emptying the list.
  const people = await db.user.findMany({
    where: {
      status: 'active',
      clerkId: clerkPeople ? { in: clerkPeople.map((person) => person.clerkId) } : { not: null },
    },
    select: { id: true, name: true, username: true, email: true },
  });

  const assignable = people
    .map((person) => ({ id: person.id, label: personLabel(person) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // One call per node, not per config, and a node that will not answer just leaves its configs
  // reading "unreachable" instead of taking the page down.
  const usage = await usageByConfig(configs);
  const rows = configs.map((config) => ({
    ...config,
    connection: connectionOf({
      status: config.status,
      sourceType: config.sourceType,
      usage: usage.get(config.id),
    }),
  }));

  const live = configs.filter((config) => config.status === 'active').length;
  const inUse = rows.filter((row) => row.connection.kind === 'connected').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configs"
        description={
          configs.length
            ? `${pluralise(configs.length, 'config')}, ${live} live, ${inUse} in use.`
            : 'WireGuard configs issued to people and their devices.'
        }
        action={
          canGenerate ? (
            <div className="flex items-center gap-2">
              <UploadConfigDialog sources={sources} />
              {nodes.length > 0 ? <GenerateConfigDialog nodes={nodes} users={assignable} /> : null}
            </div>
          ) : null
        }
      />

      {configs.length === 0 ? (
        <EmptyState
          title="No configs yet"
          hint={
            nodes.length === 0
              ? 'Add a node to generate configs, or store an external one from a provider like Proton.'
              : 'Generate a spare now and assign it when someone needs it.'
          }
          action={
            canGenerate ? (
              <div className="flex items-center gap-2">
                <UploadConfigDialog sources={sources} />
                {nodes.length > 0 ? <GenerateConfigDialog nodes={nodes} users={assignable} /> : null}
              </div>
            ) : null
          }
        />
      ) : (
        <DataTable columns={configColumns(assignable, canGenerate)} rows={rows} rowKey={(config) => config.id} />
      )}
    </div>
  );
}

import { requireRole } from '@/auth/roles';
import { DataTable, EmptyState, PageHeader } from '@/design-system';
import { AddNodeDialog } from '@/features/nodes/add-node-dialog';
import { nodeColumns } from '@/features/nodes/columns';
import { db } from '@/server/db';
import { pluralise } from '@/lib/format';

export default async function NodesPage() {
  // Checked here, not in the proxy — path matching can diverge from how Next routes (SPEC §2).
  const { role } = await requireRole('admin', 'ops');

  const nodes = await db.node.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { configs: true } } },
  });

  const canAdd = role === 'admin';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nodes"
        description={
          nodes.length
            ? `${pluralise(nodes.length, 'node')} issuing configs.`
            : 'Servers that terminate client tunnels.'
        }
        action={canAdd ? <AddNodeDialog /> : null}
      />

      {nodes.length === 0 ? (
        <EmptyState
          title="No nodes yet"
          hint={
            canAdd
              ? 'Install the agent on a server, then add it here to start issuing configs.'
              : 'An admin needs to add the first node.'
          }
          action={canAdd ? <AddNodeDialog /> : null}
        />
      ) : (
        <DataTable columns={nodeColumns} rows={nodes} rowKey={(node) => node.id} />
      )}
    </div>
  );
}

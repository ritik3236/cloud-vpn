import { headers } from 'next/headers';

import { requireRole } from '@/auth/roles';
import { DataTable, EmptyState, PageHeader } from '@/design-system';
import { EnrollNodeDialog } from '@/features/nodes/enroll-node-dialog';
import { nodeColumns } from '@/features/nodes/columns';
import { db } from '@/server/db';
import { pluralise } from '@/lib/format';

export default async function NodesPage() {
  // Checked here, not in the proxy — path matching can diverge from how Next routes (SPEC §2).
  const { role } = await requireRole('admin', 'ops');

  // The install command has to name this control plane, and the node reaches it over the same
  // origin the admin is already using.
  const incoming = await headers();
  const serverUrl = `${incoming.get('x-forwarded-proto') ?? 'http'}://${incoming.get('host') ?? 'localhost:3000'}`;

  const nodes = await db.node.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { configs: true } },
      configs: { where: { status: { in: ['unassigned', 'active', 'disabled'] } }, select: { id: true } },
    },
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
        action={canAdd ? <EnrollNodeDialog serverUrl={serverUrl} /> : null}
      />

      {nodes.length === 0 ? (
        <EmptyState
          title="No nodes yet"
          hint={
            canAdd
              ? 'Install the agent on a server, then add it here to start issuing configs.'
              : 'An admin needs to add the first node.'
          }
          action={canAdd ? <EnrollNodeDialog serverUrl={serverUrl} /> : null}
        />
      ) : (
        <DataTable
          columns={nodeColumns(canAdd)}
          rows={nodes.map((node) => ({ ...node, liveConfigs: node.configs.length }))} rowKey={(node) => node.id} />
      )}
    </div>
  );
}

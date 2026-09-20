import Link from 'next/link';

import { requireRole } from '@/auth/roles';
import { DataTable, EmptyState, PageHeader } from '@/design-system';
import { Button } from '@/design-system/ui/button';
import { configColumns } from '@/features/configs/columns';
import { GenerateConfigDialog } from '@/features/configs/generate-config-dialog';
import { UploadConfigDialog } from '@/features/configs/upload-config-dialog';
import { pluralise } from '@/lib/format';
import { db } from '@/server/db';
import { listExternalSources } from '@/server/external';

export default async function ConfigsPage() {
  const { role } = await requireRole('admin', 'ops');
  const canGenerate = role === 'admin';

  const [configs, nodes, sources, people] = await Promise.all([
    db.config.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        node: { select: { name: true, region: true, endpoint: true } },
        externalSource: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    db.node.findMany({ where: { status: 'active' }, select: { id: true, name: true, region: true } }),
    // Only active people can receive a config — suspending someone is meant to stop access,
    // so it must not be possible to hand them a fresh tunnel.
    listExternalSources(),
    db.user.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    }),
  ]);

  const assignable = people.map((person) => ({ id: person.id, label: person.name ?? person.email }));

  const live = configs.filter((config) => config.status === 'active').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configs"
        description={
          configs.length
            ? `${pluralise(configs.length, 'config')}, ${live} live.`
            : 'WireGuard configs issued to people and their devices.'
        }
        action={
          canGenerate ? (
            <div className="flex items-center gap-2">
              <UploadConfigDialog sources={sources} />
              {nodes.length > 0 ? <GenerateConfigDialog nodes={nodes} /> : null}
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
                {nodes.length > 0 ? <GenerateConfigDialog nodes={nodes} /> : null}
              </div>
            ) : null
          }
        />
      ) : (
        <DataTable columns={configColumns(assignable, canGenerate)} rows={configs} rowKey={(config) => config.id} />
      )}
    </div>
  );
}

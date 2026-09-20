import { notFound } from 'next/navigation';

import { AppSidebar } from '@/app/dashboard/app-sidebar';
import { DataTable, EmptyState, PageHeader, StatCard } from '@/design-system';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/design-system/ui/sidebar';
import { configColumns, type ConfigRow } from '@/features/configs/columns';
import { GenerateConfigDialog } from '@/features/configs/generate-config-dialog';
import { AddNodeDialog } from '@/features/nodes/add-node-dialog';
import { AddUserDialog } from '@/features/users/add-user-dialog';
import { nodeColumns, type NodeRow } from '@/features/nodes/columns';

const day = 86_400_000;

const nodes: NodeRow[] = [
  {
    id: 'n1', name: 'VPN-1', region: 'Singapore', provider: 'njal.la', status: 'active',
    endpoint: '80.78.31.19:51820', cidrPool: '10.8.0.0/24',
    nodePubkey: '9VvXP4QKfb3so09suPMaNr+0HwhDCFWIPz/ydL4m9kU=',
    createdAt: new Date(Date.now() - 2 * day), _count: { configs: 12 },
  },
  {
    id: 'n2', name: 'VPN-2', region: 'Frankfurt', provider: 'Hetzner', status: 'degraded',
    endpoint: '95.216.44.7:51820', cidrPool: '10.8.1.0/24',
    nodePubkey: 'Qk3mZpLx8fT2vN6cR1aYwE9sD4hJ7bU0iO5gK2lXnPs=',
    createdAt: new Date(Date.now() - 40 * day), _count: { configs: 1204 },
  },
];

const configs: ConfigRow[] = [
  { id: 'c1', status: 'active', deviceLabel: 'Phone', assignedIp: '10.8.0.5',
    pubkey: 'TID6LaHdOPlzQOtkAQP8k8zD7bQXqZgrR2EPcI2+7kI=',
    createdAt: new Date(Date.now() - 3 * 3600_000),
    node: { name: 'VPN-1' }, user: { name: 'Asha Menon', email: 'asha@example.com' } },
  { id: 'c2', status: 'unassigned', deviceLabel: null, assignedIp: '10.8.0.6',
    pubkey: 'Bx9QmT4vL2nR7sK1cY5aW8eD3hJ6bU0iO2gZ4lXnPqA=',
    createdAt: new Date(Date.now() - 20 * 60_000), node: { name: 'VPN-1' }, user: null },
  { id: 'c3', status: 'disabled', deviceLabel: 'Laptop', assignedIp: '10.8.0.7',
    pubkey: 'Mn2Kx7pQ9vR4sT1cL5aY8eW3hD6bJ0iU2gO4zXnPqB=',
    createdAt: new Date(Date.now() - 9 * day),
    node: { name: 'VPN-1' }, user: { name: null, email: 'ravi@example.com' } },
  { id: 'c4', status: 'revoked', deviceLabel: 'Old phone', assignedIp: null,
    pubkey: 'Zq5Wn8mK2xP7vT4sR1cL9aY6eD3hJ0bU2gI4oXnPqC=',
    createdAt: new Date(Date.now() - 88 * day),
    node: { name: 'VPN-2' }, user: { name: 'Asha Menon', email: 'asha@example.com' } },
];

/**
 * Fixture gallery: the real shell, the real components, fake rows. Every dashboard route is
 * gated behind a Clerk session, so this is the only way to look at the UI while building it.
 * Development only — it 404s in production so it can never ship.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <SidebarProvider>
      <AppSidebar role="admin" />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="flex-1 p-6">
          <div className="mx-auto w-full max-w-6xl space-y-8">
            <div className="space-y-6">
              <PageHeader title="Overview" description="Fleet health at a glance." />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Nodes online" value="1 / 2" hint="2 nodes registered" tone="paused" />
                <StatCard label="Live tunnels" value="1" hint="1 disabled" tone="live" />
                <StatCard label="Spare configs" value="1" hint="Generated, not yet assigned" tone="idle" />
                <StatCard label="Address use" value="42%" hint="106 of 253 addresses" tone="live" />
              </div>
            </div>

            <div className="space-y-5">
              <PageHeader title="Nodes" description="2 nodes issuing configs." action={<AddNodeDialog />} />
              <DataTable columns={nodeColumns} rows={nodes} rowKey={(n) => n.id} />
            </div>

            <div className="space-y-5">
              <PageHeader title="Configs" description="4 configs, 1 live."
                action={<GenerateConfigDialog nodes={[{ id: 'n1', name: 'VPN-1', region: 'Singapore' }]} />} />
              <DataTable
                columns={configColumns([{ id: 'u1', label: 'Asha Menon' }])}
                rows={configs}
                rowKey={(c) => c.id}
              />
            </div>

            <div className="space-y-5">
              <PageHeader title="Users" description="People who hold configs." action={<AddUserDialog />} />
              <EmptyState
                title="No users yet"
                hint="Staff add users here — there is no public signup."
                action={<AddUserDialog />}
              />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

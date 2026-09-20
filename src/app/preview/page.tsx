import { notFound } from 'next/navigation';

import { DataTable, EmptyState, PageHeader } from '@/design-system';
import { configColumns, type ConfigRow } from '@/features/configs/columns';
import { GenerateConfigDialog } from '@/features/configs/generate-config-dialog';
import { AddNodeDialog } from '@/features/nodes/add-node-dialog';
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
  {
    id: 'c1', status: 'active', deviceLabel: 'Phone', assignedIp: '10.8.0.5',
    pubkey: 'TID6LaHdOPlzQOtkAQP8k8zD7bQXqZgrR2EPcI2+7kI=',
    createdAt: new Date(Date.now() - 3 * 3600_000),
    node: { name: 'VPN-1' }, user: { name: 'Asha Menon', email: 'asha@example.com' },
  },
  {
    id: 'c2', status: 'unassigned', deviceLabel: null, assignedIp: '10.8.0.6',
    pubkey: 'Bx9QmT4vL2nR7sK1cY5aW8eD3hJ6bU0iO2gZ4lXnPqA=',
    createdAt: new Date(Date.now() - 20 * 60_000), node: { name: 'VPN-1' }, user: null,
  },
  {
    id: 'c3', status: 'disabled', deviceLabel: 'Laptop', assignedIp: '10.8.0.7',
    pubkey: 'Mn2Kx7pQ9vR4sT1cL5aY8eW3hD6bJ0iU2gO4zXnPqB=',
    createdAt: new Date(Date.now() - 9 * day),
    node: { name: 'VPN-1' }, user: { name: null, email: 'ravi@example.com' },
  },
  {
    id: 'c4', status: 'revoked', deviceLabel: 'Old phone', assignedIp: null,
    pubkey: 'Zq5Wn8mK2xP7vT4sR1cL9aY6eD3hJ0bU2gI4oXnPqC=',
    createdAt: new Date(Date.now() - 88 * day),
    node: { name: 'VPN-2' }, user: { name: 'Asha Menon', email: 'asha@example.com' },
  },
];

/**
 * Fixture gallery for working on the UI without a Clerk session — every dashboard route is
 * gated, so this is the only way to look at these components while building them. Development
 * only; it 404s in production so it can never ship.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-6 py-8">
      <div className="space-y-5">
        <PageHeader title="Nodes" description="2 nodes issuing configs."
          action={<AddNodeDialog />} />
        <DataTable columns={nodeColumns} rows={nodes} rowKey={(n) => n.id} />
      </div>

      <div className="space-y-5">
        <PageHeader title="Configs" description="4 configs, 1 live."
          action={<GenerateConfigDialog nodes={[{ id: "n1", name: "VPN-1", region: "Singapore" }]} />} />
        <DataTable columns={configColumns} rows={configs} rowKey={(c) => c.id} />
      </div>

      <div className="space-y-5">
        <PageHeader title="Configs" description="WireGuard configs issued to people and their devices." />
        <EmptyState
          title="No configs yet"
          hint="Generate a spare now and assign it when someone needs it."
          action={<GenerateConfigDialog nodes={[{ id: "n1", name: "VPN-1", region: "Singapore" }]} />}
        />
      </div>
    </main>
  );
}

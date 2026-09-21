import { notFound } from 'next/navigation';

import { configQrSvg } from '@/server/qr';
import { AppSidebar } from '@/app/dashboard/app-sidebar';
import { DataTable, EmptyState, PageHeader, StatCard } from '@/design-system';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/design-system/ui/sidebar';
import { configColumns, type ConfigRow } from '@/features/configs/columns';
import { GenerateConfigDialog } from '@/features/configs/generate-config-dialog';
import { UploadConfigDialog } from '@/features/configs/upload-config-dialog';
import { EnrollNodeDialog } from '@/features/nodes/enroll-node-dialog';
import { CreateInClerkButton } from '@/features/users/create-in-clerk-button';
import { nodeColumns, type NodeRow } from '@/features/nodes/columns';
import { userColumns, type UserRow } from '@/features/users/columns';

import { ConfigCard } from '@/features/me/config-card';

import { ConfigDialogDemo } from './config-dialog-demo';

const day = 86_400_000;
// Module scope: a component body must stay pure.
const nowSeconds = Math.floor(Date.now() / 1000);

const nodes: NodeRow[] = [
  {
    id: 'n1', name: 'VPN-1', region: 'Stockholm', provider: 'njal.la', status: 'active',
    endpoint: '80.78.31.19:51820', cidrPool: '10.8.0.0/24',
    nodePubkey: '9VvXP4QKfb3so09suPMaNr+0HwhDCFWIPz/ydL4m9kU=',
    createdAt: new Date(Date.now() - 2 * day), _count: { configs: 12 }, liveConfigs: 3,
  },
  {
    id: 'n2', name: 'VPN-2', region: 'Frankfurt', provider: 'Hetzner', status: 'degraded',
    endpoint: '95.216.44.7:51820', cidrPool: '10.8.1.0/24',
    nodePubkey: 'Qk3mZpLx8fT2vN6cR1aYwE9sD4hJ7bU0iO5gK2lXnPs=',
    createdAt: new Date(Date.now() - 40 * day), _count: { configs: 1204 }, liveConfigs: 0,
  },
];

const configs: ConfigRow[] = [
  { id: 'c1', status: 'active', sourceType: 'managed', externalSource: null, deviceLabel: 'Phone', assignedIp: '10.8.0.5',
    pubkey: 'TID6LaHdOPlzQOtkAQP8k8zD7bQXqZgrR2EPcI2+7kI=',
    createdAt: new Date(Date.now() - 3 * 3600_000),
    node: { name: 'VPN-1', region: 'Stockholm', endpoint: '80.78.31.19:51820' }, user: { name: 'Asha Menon', username: 'asha', email: 'asha@example.com' },
    connection: { kind: 'connected', lastHandshake: nowSeconds - 45 } },
  { id: 'c2', status: 'unassigned', sourceType: 'managed', externalSource: null, deviceLabel: null, assignedIp: '10.8.0.6',
    pubkey: 'Bx9QmT4vL2nR7sK1cY5aW8eD3hJ6bU0iO2gZ4lXnPqA=',
    createdAt: new Date(Date.now() - 20 * 60_000), node: { name: 'VPN-1', region: 'Stockholm', endpoint: '80.78.31.19:51820' }, user: null,
    connection: { kind: 'none' } },
  { id: 'c3', status: 'disabled', sourceType: 'managed', externalSource: null, deviceLabel: 'Laptop', assignedIp: '10.8.0.7',
    pubkey: 'Mn2Kx7pQ9vR4sT1cL5aY8eW3hD6bJ0iU2gO4zXnPqB=',
    createdAt: new Date(Date.now() - 9 * day),
    node: { name: 'VPN-1', region: 'Stockholm', endpoint: '80.78.31.19:51820' }, user: { name: null, username: 'ravi', email: null },
    connection: { kind: 'none' } },
  { id: 'c4', status: 'revoked', sourceType: 'managed', externalSource: null, deviceLabel: 'Old phone', assignedIp: null,
    pubkey: 'Zq5Wn8mK2xP7vT4sR1cL9aY6eD3hJ0bU2gI4oXnPqC=',
    createdAt: new Date(Date.now() - 88 * day),
    node: { name: 'VPN-2', region: 'Frankfurt', endpoint: '95.216.44.7:51820' }, user: { name: 'Asha Menon', username: 'asha', email: 'asha@example.com' } },
  {
    id: 'c5', status: 'active', sourceType: 'static',
    externalSource: { name: 'Proton' },
    deviceLabel: 'Work laptop', assignedIp: '10.2.0.2', pubkey: null,
    createdAt: new Date(Date.now() - 5 * day), node: null,
    user: { name: 'Ravi Shah', username: 'ravi', email: 'ravi@example.com' },
    connection: { kind: 'untracked' },
  },
];

const users: UserRow[] = [
  {
    id: 'u1', label: '@admin', secondary: null, status: 'active', live: 1, configs: 2,
    presence: { kind: 'present', person: {
      clerkId: 'user_1', username: 'admin', name: null, email: null, banned: false, role: 'admin',
      createdAt: new Date(Date.now() - 40 * day), lastSignInAt: new Date(Date.now() - 2 * 3600_000),
    } },
  },
  {
    id: 'u2', label: 'Asha Menon', secondary: '@asha · asha@example.com', status: 'active', live: 2, configs: 3,
    presence: { kind: 'present', person: {
      clerkId: 'user_2', username: 'asha', name: 'Asha Menon', email: 'asha@example.com', banned: false,
      role: null, createdAt: new Date(Date.now() - 12 * day), lastSignInAt: new Date(Date.now() - 3 * day),
    } },
  },
  {
    id: 'u3', label: '@ravi', secondary: null, status: 'suspended', live: 1, configs: 1,
    presence: { kind: 'present', person: {
      clerkId: 'user_3', username: 'ravi', name: null, email: null, banned: true, role: null,
      createdAt: new Date(Date.now() - 5 * day), lastSignInAt: null,
    } },
  },
  {
    id: 'u4', label: 'Priya Rao', secondary: 'priya@example.com', status: 'active', live: 0, configs: 1,
    presence: { kind: 'missing' },
  },
];

/**
 * Fixture gallery: the real shell, the real components, fake rows. Every dashboard route is
 * gated behind a Clerk session, so this is the only way to look at the UI while building it.
 * Development only — it 404s in production so it can never ship.
 */
export default async function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const sampleConf = [
    '[Interface]',
    'PrivateKey = aGVsbG8gd29ybGQgdGhpcyBpcyAzMiBieXRlcyE=',
    'Address = 10.8.0.5/32',
    'DNS = 1.1.1.1',
    '',
    '[Peer]',
    'PublicKey = 9VvXP4QKfb3so09suPMaNr+0HwhDCFWIPz/ydL4m9kU=',
    'Endpoint = 80.78.31.19:51820',
    'AllowedIPs = 0.0.0.0/0',
    'PersistentKeepalive = 25',
  ].join('\n');
  const qrSvg = await configQrSvg(sampleConf);

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
              <PageHeader title="Nodes" description="2 nodes issuing configs." action={<EnrollNodeDialog serverUrl="https://vpn.zoiee.me" />} />
              <DataTable columns={nodeColumns(true)} rows={nodes} rowKey={(n) => n.id} />
            </div>

            <div className="space-y-5">
              <PageHeader title="Configs" description="5 configs, 2 live."
                action={
                  <div className="flex items-center gap-2">
                    <UploadConfigDialog sources={[{ id: 's1', name: 'Proton' }]} />
                    <GenerateConfigDialog
                      nodes={[{ id: 'n1', name: 'VPN-1', region: 'Stockholm' }]}
                      users={[{ id: 'u1', label: '@admin' }, { id: 'u2', label: 'Asha Menon' }]}
                    />
                  </div>
                } />
              <DataTable
                columns={configColumns([{ id: 'u1', label: 'Asha Menon' }], true)}
                rows={configs}
                rowKey={(c) => c.id}
              />
            </div>

            <div className="space-y-5">
              <PageHeader
                title="Your connections"
                description="What a user sees — their own configs and nothing else."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <ConfigCard
                  config={{
                    id: 'm1', status: 'active', deviceLabel: 'Phone', assignedIp: '10.8.0.5',
                    sourceType: 'managed', node: { name: 'VPN-1', region: 'Stockholm' },
                    externalSource: null,
                    connection: { kind: 'connected', lastHandshake: nowSeconds - 30 },
                  }}
                />
                <ConfigCard
                  config={{
                    id: 'm2', status: 'active', deviceLabel: 'Work laptop', assignedIp: '10.2.0.2',
                    sourceType: 'static', node: null, externalSource: { name: 'Proton' },
                    connection: { kind: 'untracked' },
                  }}
                />
                <ConfigCard
                  config={{
                    id: 'm3', status: 'disabled', deviceLabel: 'Old tablet', assignedIp: '10.8.0.9',
                    sourceType: 'managed', node: { name: 'VPN-1', region: 'Stockholm' },
                    externalSource: null,
                    connection: { kind: 'none' },
                  }}
                />
              </div>
            </div>

            <div className="space-y-5">
              <PageHeader
                title="Users"
                description="3 people in Clerk, 2 active."
                action={
                  <div className="flex items-center gap-2">
                    <ConfigDialogDemo
                      result={{ ok: true, filename: 'vpn-1-phone.conf', content: sampleConf, qrSvg }}
                    />
                    <CreateInClerkButton />
                  </div>
                }
              />
              <DataTable columns={userColumns(true)} rows={users} rowKey={(user) => user.id} />
              <p className="text-xs text-muted-foreground">
                Clerk is the register of people; this list mirrors it. Suspending someone here bans
                them in Clerk and switches their tunnels off.
              </p>
              <EmptyState
                title="No one here yet"
                hint="People come from Clerk. Create one there with a username and password and no role — a role would make them staff."
                action={<CreateInClerkButton />}
              />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

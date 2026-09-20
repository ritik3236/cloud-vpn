import { requireRole } from '@/auth/roles';
import { Copyable, DataTable, EmptyState, PageHeader, StatusPill, type Column } from '@/design-system';
import { formatDateTime, formatNumber, pluralise, relativeTime } from '@/lib/format';
import { db } from '@/server/db';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  createdAt: Date;
  _count: { configs: number };
};

const columns: Column<UserRow>[] = [
  {
    key: 'person',
    header: 'Person',
    cell: (user) => (
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{user.name ?? user.email}</div>
        {user.name ? <div className="truncate text-xs text-muted-foreground">{user.email}</div> : null}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (user) => (
      <StatusPill tone={user.status === 'active' ? 'live' : 'paused'}>
        {user.status === 'active' ? 'Active' : 'Suspended'}
      </StatusPill>
    ),
  },
  {
    key: 'email',
    header: 'Email',
    cell: (user) => <Copyable value={user.email} label="email" mono={false} />,
  },
  {
    key: 'configs',
    header: 'Configs',
    numeric: true,
    cell: (user) => <span className="text-sm">{formatNumber(user._count.configs)}</span>,
  },
  {
    key: 'joined',
    header: 'Added',
    cell: (user) => (
      <span className="text-xs text-muted-foreground" title={formatDateTime(user.createdAt)}>
        {relativeTime(user.createdAt)}
      </span>
    ),
  },
];

export default async function UsersPage() {
  await requireRole('admin', 'ops');

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { _count: { select: { configs: true } } },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description={
          users.length ? `${pluralise(users.length, 'person')} can hold configs.` : 'People who hold configs.'
        }
      />

      {users.length === 0 ? (
        <EmptyState
          title="No users yet"
          hint="Staff add users here — there is no public signup. Configs can be generated without a user, but they stay spare until someone exists to hold them."
        />
      ) : (
        <DataTable columns={columns} rows={users} rowKey={(user) => user.id} />
      )}
    </div>
  );
}

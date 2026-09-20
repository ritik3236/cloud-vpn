import Link from 'next/link';

import { requireRole } from '@/auth/roles';
import { Copyable, DataTable, EmptyState, PageHeader, StatusPill, type Column } from '@/design-system';
import { AddUserDialog } from '@/features/users/add-user-dialog';
import { UserRowActions } from '@/features/users/row-actions';
import { formatDateTime, formatNumber, pluralise, relativeTime } from '@/lib/format';
import { db } from '@/server/db';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  createdAt: Date;
  configs: { status: string }[];
};

const labelOf = (user: UserRow) => user.name ?? user.email;
const liveCount = (user: UserRow) => user.configs.filter((c) => c.status === 'active').length;

const columns = (canManage: boolean): Column<UserRow>[] => [
  {
    key: 'person',
    header: 'Person',
    cell: (user) => (
      <div className="min-w-0">
        {/* The name is the link, not the row — the row also carries an actions menu, and a
            button inside a link is not a thing. */}
        <Link
          href={`/dashboard/users/${user.id}`}
          className="truncate text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {labelOf(user)}
        </Link>
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
  { key: 'email', header: 'Email', cell: (user) => <Copyable value={user.email} label="email" mono={false} /> },
  {
    key: 'live',
    header: 'Live tunnels',
    numeric: true,
    cell: (user) => <span className="text-sm">{formatNumber(liveCount(user))}</span>,
  },
  {
    key: 'configs',
    header: 'Configs',
    numeric: true,
    cell: (user) => <span className="text-sm">{formatNumber(user.configs.length)}</span>,
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
  {
    key: 'actions',
    header: '',
    headClassName: 'w-10',
    cell: (user) =>
      canManage ? (
        <div className="flex justify-end">
          <UserRowActions
            user={{
              id: user.id,
              label: labelOf(user),
              status: user.status,
              liveConfigs: liveCount(user),
            }}
          />
        </div>
      ) : null,
  },
];

export default async function UsersPage() {
  const { role } = await requireRole('admin', 'ops');
  const canManage = role === 'admin';

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { configs: { select: { status: true } } },
  });

  const active = users.filter((user) => user.status === 'active').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description={
          users.length
            ? `${pluralise(users.length, 'person', 'people')}, ${active} active.`
            : 'People who hold configs.'
        }
        action={canManage ? <AddUserDialog /> : null}
      />

      {users.length === 0 ? (
        <EmptyState
          title="No users yet"
          hint="Staff add users here — there is no public signup. Configs can be generated without a user, but they stay spare until someone exists to hold them."
          action={canManage ? <AddUserDialog /> : null}
        />
      ) : (
        <DataTable columns={columns(canManage)} rows={users} rowKey={(user) => user.id} />
      )}
    </div>
  );
}

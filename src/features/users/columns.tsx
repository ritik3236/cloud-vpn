import Link from 'next/link';

import { StatusPill, type Column } from '@/design-system';
import { Badge } from '@/design-system/ui/badge';
import { UserRowActions } from '@/features/users/row-actions';
import { formatDateTime, formatNumber, relativeTime } from '@/lib/format';
import { roleLabel } from '@/lib/person';

import type { Presence } from './presence';

export type UserRow = {
  id: string;
  label: string;
  secondary: string | null;
  status: string;
  live: number;
  configs: number;
  presence: Presence;
};

const staffRoleOf = (presence: Presence) =>
  presence.kind === 'present' ? roleLabel(presence.person.role) : null;

export const userColumns = (canManage: boolean): Column<UserRow>[] => [
  {
    key: 'person',
    header: 'Person',
    cell: (user) => {
      const staffRole = staffRoleOf(user.presence);
      return (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {/* The name is the link, not the row — the row also carries an actions menu, and a
                button inside a link is not a thing. */}
            <Link
              href={`/dashboard/users/${user.id}`}
              className="truncate text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {user.label}
            </Link>
            {staffRole ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[11px] text-muted-foreground">
                {staffRole}
              </Badge>
            ) : null}
          </div>
          {user.secondary ? (
            <div className="truncate text-xs text-muted-foreground">{user.secondary}</div>
          ) : null}
        </div>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    cell: (user) =>
      user.presence.kind === 'missing' ? (
        <StatusPill tone="dead">Not in Clerk</StatusPill>
      ) : (
        <StatusPill tone={user.status === 'active' ? 'live' : 'paused'}>
          {user.status === 'active' ? 'Active' : 'Suspended'}
        </StatusPill>
      ),
  },
  {
    key: 'seen',
    header: 'Last sign-in',
    cell: (user) => {
      if (user.presence.kind !== 'present') return <span className="text-xs text-muted-foreground">—</span>;
      const at = user.presence.person.lastSignInAt;
      return at ? (
        <span className="text-xs text-muted-foreground" title={formatDateTime(at)}>
          {relativeTime(at)}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Never</span>
      );
    },
  },
  {
    key: 'live',
    header: 'Live tunnels',
    numeric: true,
    cell: (user) => {
      // Someone who cannot sign in but is still connected is the state worth catching here:
      // a ban made directly in Clerk stops sign-in, never a tunnel.
      const stranded = user.live > 0 && (user.status !== 'active' || user.presence.kind === 'missing');
      return (
        <span
          className={stranded ? 'text-sm font-medium text-tone-paused' : 'text-sm'}
          title={stranded ? 'Still connected although they cannot sign in — stop them from the row menu.' : undefined}
        >
          {formatNumber(user.live)}
        </span>
      );
    },
  },
  {
    key: 'configs',
    header: 'Configs',
    numeric: true,
    cell: (user) => <span className="text-sm">{formatNumber(user.configs)}</span>,
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
              label: user.label,
              status: user.status,
              liveConfigs: user.live,
              inClerk: user.presence.kind !== 'missing',
            }}
          />
        </div>
      ) : null,
  },
];

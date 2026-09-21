import { requireRole } from '@/auth/roles';
import { DataTable, EmptyState, PageHeader } from '@/design-system';
import { userColumns, type UserRow } from '@/features/users/columns';
import { CreateInClerkButton } from '@/features/users/create-in-clerk-button';
import { presenceLookup } from '@/features/users/presence';
import { RefreshOnFocus } from '@/features/users/refresh-on-focus';
import { pluralise } from '@/lib/format';
import { personLabel } from '@/lib/person';
import { db } from '@/server/db';
import { syncUsersFromClerk } from '@/server/users';

const TAKE = 50;

export default async function UsersPage() {
  const { role } = await requireRole('admin', 'ops');
  const canManage = role === 'admin';

  // Sync first: the list below is Clerk's, and a person created there a moment ago should be in
  // it. Forced, because this is the page whose whole job is to show who exists.
  const people = await syncUsersFromClerk({ force: true });
  const presenceOf = presenceLookup(people);

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: TAKE,
    include: { configs: { select: { status: true } } },
  });

  const rows: UserRow[] = users.map((user) => {
    const label = personLabel(user);
    return {
      id: user.id,
      label,
      secondary:
        [user.username ? `@${user.username}` : null, user.email]
          .filter((part): part is string => Boolean(part) && part !== label)
          .join(' · ') || null,
      status: user.status,
      live: user.configs.filter((config) => config.status === 'active').length,
      configs: user.configs.length,
      presence: presenceOf(user.clerkId),
    };
  });

  const missing = rows.filter((row) => row.presence.kind === 'missing').length;
  const description = people
    ? `${pluralise(people.length, 'person', 'people')} in Clerk, ${people.filter((person) => !person.banned).length} active` +
      `${missing ? `, ${missing} not in Clerk` : ''}.` +
      `${users.length === TAKE ? ` Showing the ${TAKE} most recent.` : ''}`
    : 'People who sign in and hold configs.';

  return (
    <div className="space-y-5">
      <RefreshOnFocus />
      <PageHeader
        title="Users"
        description={description}
        action={canManage ? <CreateInClerkButton /> : null}
      />

      {people ? null : (
        <p
          role="alert"
          className="rounded-lg bg-tone-paused-bg px-3 py-2 text-xs text-tone-paused"
        >
          Could not reach Clerk, so roles and sign-ins are missing. This is the list as last synced.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No one here yet"
          hint="People come from Clerk. Create one there with a username and password and no role — a role would make them staff. They show up here as soon as they exist."
          action={canManage ? <CreateInClerkButton /> : null}
        />
      ) : (
        <>
          <DataTable columns={userColumns(canManage)} rows={rows} rowKey={(user) => user.id} />
          <p className="text-xs text-muted-foreground">
            Clerk is the register of people; this list mirrors it. Suspending someone here bans
            them in Clerk and switches their tunnels off. A ban made in Clerk itself stops sign-in
            only — their tunnels keep running until you stop them here.
          </p>
        </>
      )}
    </div>
  );
}

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { EmptyState } from '@/design-system';
import { ConfigCard } from '@/features/me/config-card';
import { pluralise } from '@/lib/format';
import { myConfigs, NotAMemberError } from '@/server/me';

export default async function MePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  let data;
  try {
    data = await myConfigs();
  } catch (error) {
    if (error instanceof NotAMemberError) {
      return (
        <div className="py-10">
          <EmptyState
            title="You're not set up yet"
            hint="This account isn't on the list. Ask an admin to add you, then sign in again."
          />
        </div>
      );
    }
    throw error;
  }

  const { user, configs } = data;
  const active = configs.filter((config) => config.status === 'active').length;

  if (user.status !== 'active') {
    return (
      <div className="py-10">
        <EmptyState
          title="Your access is paused"
          hint="An admin has suspended this account. Your connections are switched off until it's restored."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {user.name ? `Hi ${user.name.split(' ')[0]}` : 'Your connections'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {configs.length === 0
            ? 'Nothing has been issued to you yet.'
            : `${pluralise(configs.length, 'connection')}, ${active} ready to use.`}
        </p>
      </div>

      {configs.length === 0 ? (
        <EmptyState
          title="No connections yet"
          hint="An admin will issue one to you. You'll see it here — no need to ask twice."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {configs.map((config) => (
              <ConfigCard key={config.id} config={config} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Scan the QR with the WireGuard app on a phone, or download the file for a laptop. You
            need one per device — a single connection cannot be shared across two.
          </p>
        </>
      )}
    </div>
  );
}

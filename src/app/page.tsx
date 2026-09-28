import { auth } from '@clerk/nextjs/server';

import { currentRole } from '@/auth/roles';
import { PortalHeader } from '@/features/portal/portal-header';
import { PORTAL } from '@/features/services/registry';
import { ServiceGrid } from '@/features/services/service-grid';

/**
 * The front door. Signed out it says what lives here; signed in it is the chooser — every
 * service the person can open, including the one they are most likely heading to.
 */
export default async function PortalPage() {
  const { userId } = await auth();
  const role = userId ? await currentRole() : null;
  const signedIn = Boolean(userId);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PortalHeader signedIn={signedIn} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {signedIn ? 'Choose a service' : PORTAL.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {signedIn ? 'Everything your account can open.' : PORTAL.tagline}
        </p>

        <div className="mt-6">
          <ServiceGrid hrefFor={(service) => (signedIn ? service.entry(role) : '/sign-in')} />
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          More services will appear here as they come online. Accounts are created by an admin —
          there is no public sign-up.
        </p>
      </main>
    </div>
  );
}

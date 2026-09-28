import { auth } from '@clerk/nextjs/server';

import { currentRole } from '@/auth/roles';
import { Landing } from '@/features/portal/landing';
import { PortalHeader } from '@/features/portal/portal-header';
import { ServiceGrid } from '@/features/services/service-grid';

/**
 * The front door has two faces: a product page for people who have not signed in, and the
 * chooser for people who have. Marketing at someone already inside would be noise.
 */
export default async function PortalPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <PortalHeader signedIn={false} />
        <Landing />
      </div>
    );
  }

  const role = await currentRole();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PortalHeader signedIn />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a service</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything your account can open.</p>
        <div className="mt-6">
          <ServiceGrid hrefFor={(service) => service.entry(role)} />
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          More services will appear here as they come online.
        </p>
      </main>
    </div>
  );
}

import { redirect } from 'next/navigation';

import { ForbiddenError, requireRole, UnauthenticatedError } from '@/auth/roles';

/**
 * Smallest surface that exercises the real gate (SPEC §2): the role is read from the Clerk
 * session server-side, and neither the proxy nor the client is trusted to have checked.
 */
export default async function DashboardPage() {
  let session: { userId: string; role: string };

  try {
    session = await requireRole('admin', 'ops');
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/sign-in');
    if (err instanceof ForbiddenError) {
      return (
        <main className="flex flex-1 items-center justify-center p-6">
          <p role="alert" className="text-sm text-red-600">
            Your account has no staff role. An admin must grant one before you can use this.
          </p>
        </main>
      );
    }
    throw err;
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-lg font-medium">Signed in as {session.role}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Role read from the Clerk session server-side. Dashboards come next (SPEC §11).
        </p>
      </div>
    </main>
  );
}

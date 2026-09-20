import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

import { ForbiddenError, requireRole, UnauthenticatedError } from '@/auth/roles';
import { Toaster } from '@/design-system/ui/sonner';

import { DashboardNav } from './nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let role: string;
  try {
    ({ role } = await requireRole('admin', 'ops'));
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect('/sign-in');
    if (error instanceof ForbiddenError) {
      return (
        <main className="flex flex-1 items-center justify-center p-6">
          <p role="alert" className="max-w-sm text-center text-sm text-muted-foreground">
            Your account has no staff role yet. An admin needs to grant you one before you can
            use the control plane.
          </p>
        </main>
      );
    }
    throw error;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-6 border-b border-border px-6">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-tight">Cloud VPN</span>
          <DashboardNav />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground capitalize">{role}</span>
          <UserButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
      <Toaster position="bottom-right" />
    </div>
  );
}

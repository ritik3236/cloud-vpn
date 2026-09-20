import { redirect } from 'next/navigation';

import { ForbiddenError, requireRole, UnauthenticatedError } from '@/auth/roles';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/design-system/ui/sidebar';
import { Toaster } from '@/design-system/ui/sonner';

import { AppSidebar } from './app-sidebar';

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
            Your account has no staff role yet. An admin needs to grant you one before you can use
            the control plane.
          </p>
        </main>
      );
    }
    throw error;
  }

  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="flex-1 p-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>
      </SidebarInset>
      <Toaster position="bottom-right" />
    </SidebarProvider>
  );
}

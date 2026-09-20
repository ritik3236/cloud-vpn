import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ForbiddenError, requireRole, UnauthenticatedError } from '@/auth/roles';
import { Button } from '@/design-system/ui/button';
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
          <div className="max-w-sm space-y-3 text-center">
            <p role="alert" className="text-sm text-muted-foreground">
              This account has no staff role, so the control plane is not available to you.
            </p>
            <Button asChild size="sm" className="h-8">
              <Link href="/me">Go to your connections</Link>
            </Button>
          </div>
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

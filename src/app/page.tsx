import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { currentRole } from '@/auth/roles';

/**
 * No marketing surface — this is an internal control plane. Staff land on the dashboard,
 * everyone else on their own connections.
 */
export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  redirect((await currentRole()) ? '/dashboard' : '/me');
}

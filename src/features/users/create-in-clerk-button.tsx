import { ExternalLink, UserPlus } from 'lucide-react';

import { Button } from '@/design-system/ui/button';

/**
 * Clerk owns who exists, so adding someone happens there, not here. `last-active` lands on the
 * instance the admin last opened — they pick production or development in Clerk's own switcher.
 */
const CLERK_USERS_URL = 'https://dashboard.clerk.com/last-active?path=users';

export function CreateInClerkButton() {
  return (
    <Button asChild size="sm" className="h-8">
      <a href={CLERK_USERS_URL} target="_blank" rel="noreferrer">
        <UserPlus className="size-4" />
        Create User in Clerk
        <ExternalLink className="size-3.5 opacity-70" />
      </a>
    </Button>
  );
}

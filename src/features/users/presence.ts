import type { ClerkPerson } from '@/server/users';

/**
 * `missing` is a Clerk row Clerk does not have — either older than this mirror, or deleted there.
 * It cannot sign in. `local` is a person an admin created with no login on purpose: as real as
 * anyone, they just receive their files by hand. `unknown` only happens when Clerk is unreachable,
 * and deliberately reads as present: an outage must not make everyone look deleted.
 */
export type Presence =
  | { kind: 'present'; person: ClerkPerson }
  | { kind: 'local' }
  | { kind: 'missing' }
  | { kind: 'unknown' };

/** One rule for what a row's presence is, shared by the list and the detail view. */
export function presenceLookup(people: ClerkPerson[] | null) {
  const byClerkId = new Map((people ?? []).map((person) => [person.clerkId, person]));

  return (user: { kind: 'clerk' | 'local'; clerkId: string | null }): Presence => {
    if (user.kind === 'local') return { kind: 'local' };
    if (!user.clerkId) return { kind: 'missing' };
    if (!people) return { kind: 'unknown' };
    const person = byClerkId.get(user.clerkId);
    return person ? { kind: 'present', person } : { kind: 'missing' };
  };
}

/** What a person's account allows, which decides the actions offered on them. */
export type Access = 'clerk' | 'local' | 'missing';

export const accessOf = (presence: Presence): Access =>
  presence.kind === 'local' ? 'local' : presence.kind === 'missing' ? 'missing' : 'clerk';

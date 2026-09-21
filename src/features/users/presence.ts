import type { ClerkPerson } from '@/server/users';

/**
 * `missing` is a row Clerk does not have — either older than this mirror, or deleted there. It
 * cannot sign in. `unknown` only happens when Clerk is unreachable, and deliberately reads as
 * present: an outage must not make everyone look deleted.
 */
export type Presence =
  | { kind: 'present'; person: ClerkPerson }
  | { kind: 'missing' }
  | { kind: 'unknown' };

/** One rule for what Clerk says about a row, shared by the list and the detail view. */
export function presenceLookup(people: ClerkPerson[] | null) {
  const byClerkId = new Map((people ?? []).map((person) => [person.clerkId, person]));

  return (clerkId: string | null): Presence => {
    if (!clerkId) return { kind: 'missing' };
    if (!people) return { kind: 'unknown' };
    const person = byClerkId.get(clerkId);
    return person ? { kind: 'present', person } : { kind: 'missing' };
  };
}

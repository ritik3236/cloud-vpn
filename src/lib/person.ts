import type { Role } from '@/auth/roles';

/**
 * How a person is named everywhere: full name, then username, then email. Username-only users
 * are the default now, so falling straight from name to email would label most people as blank.
 */
/** How a staff role is written for people; a plain user has none and shows nothing. */
export const roleLabel = (role: Role | null): string | null =>
  role === null ? null : role === 'admin' ? 'Admin' : 'Ops';

export function personLabel(person: {
  name: string | null;
  username: string | null;
  email: string | null;
}): string {
  return person.name ?? (person.username ? `@${person.username}` : null) ?? person.email ?? 'Unnamed user';
}

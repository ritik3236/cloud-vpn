import { auth } from '@clerk/nextjs/server';

export const ROLES = ['admin', 'ops'] as const;
export type Role = (typeof ROLES)[number];

/**
 * SPEC §2 — roles live in Clerk and are checked server-side on every call.
 * Requires the session token to carry a `metadata` claim holding `roles`.
 */
export async function currentRole(): Promise<Role | null> {
  const { sessionClaims } = await auth();
  const metadata = sessionClaims?.metadata as { roles?: unknown } | undefined;
  const roles = Array.isArray(metadata?.roles) ? metadata.roles : [];
  return ROLES.find((r) => roles.includes(r)) ?? null;
}

export class ForbiddenError extends Error {
  constructor(required: readonly Role[]) {
    super(`requires one of: ${required.join(', ')}`);
    this.name = 'ForbiddenError';
  }
}

export async function requireRole(...allowed: Role[]): Promise<Role> {
  const role = await currentRole();
  if (!role || !allowed.includes(role)) throw new ForbiddenError(allowed);
  return role;
}

/** Retrieving key material is a create-level power — admin only (SPEC §2). */
export const requireAdmin = () => requireRole('admin');

import { auth } from '@clerk/nextjs/server';

export const ROLES = ['admin', 'ops'] as const;
export type Role = (typeof ROLES)[number];

export class UnauthenticatedError extends Error {
  constructor() {
    super('not signed in');
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends Error {
  constructor(required: readonly Role[]) {
    super(`requires one of: ${required.join(', ')}`);
    this.name = 'ForbiddenError';
  }
}

function roleFrom(sessionClaims: unknown): Role | null {
  const metadata = (sessionClaims as { metadata?: { roles?: unknown } } | null)?.metadata;
  const roles = Array.isArray(metadata?.roles) ? metadata.roles : [];
  return ROLES.find((r) => roles.includes(r)) ?? null;
}

export async function currentRole(): Promise<Role | null> {
  const { sessionClaims } = await auth();
  return roleFrom(sessionClaims);
}

/**
 * The authorization gate (SPEC §2). Call this in every page, route handler and server function
 * that reads or mutates protected data — never rely on the proxy to have done it.
 *
 * Distinguishes 401 from 403 so a missing session does not read as a permissions bug.
 */
export async function requireRole(...allowed: Role[]): Promise<{ userId: string; role: Role }> {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new UnauthenticatedError();

  const role = roleFrom(sessionClaims);
  if (!role || !allowed.includes(role)) throw new ForbiddenError(allowed);

  return { userId, role };
}

/** Retrieving key material is a create-level power — admin only (SPEC §2). */
export const requireAdmin = () => requireRole('admin');

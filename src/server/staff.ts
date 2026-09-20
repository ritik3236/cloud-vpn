import 'server-only';

import { requireRole, type Role } from '@/auth/roles';
import { db } from '@/server/db';

/**
 * Clerk is the authority for roles (SPEC §2). The `staff` row exists so `configs.issued_by` has
 * something to reference, and is upserted on first use — an admin added in Clerk can act
 * immediately without a separate onboarding step, and the row always mirrors the live claim.
 */
export async function actingStaff(...allowed: Role[]) {
  const { userId, role } = await requireRole(...allowed);
  return db.staff.upsert({
    where: { clerkId: userId },
    create: { clerkId: userId, role },
    update: { role },
  });
}

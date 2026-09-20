import 'server-only';

import { AUDIT_ACTIONS, recordAudit } from '@/server/audit';
import { disableConfig } from '@/server/configs/lifecycle';
import { db } from '@/server/db';
import { actingStaff } from '@/server/staff';

export class InvalidUserInput extends Error {
  constructor(field: string, detail: string) {
    super(`${field}: ${detail}`);
    this.name = 'InvalidUserInput';
  }
}

export class DuplicateUserError extends Error {
  constructor(email: string) {
    super(`${email} is already on the list`);
    this.name = 'DuplicateUserError';
  }
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Users are added by staff — SPEC §1 rules out public signup. A user row is what a config can
 * be assigned to; linking it to a Clerk identity for the self-service dashboard is a separate
 * step, so onboarding never blocks on an invite being accepted.
 */
export async function createUser(input: { name?: string; email: string }) {
  const staff = await actingStaff('admin');

  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new InvalidUserInput('email', 'must look like name@example.com');

  if (await db.user.findUnique({ where: { email } })) throw new DuplicateUserError(email);

  const user = await db.user.create({ data: { email, name: input.name?.trim() || null } });
  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.userCreate,
    target: user.id,
    detail: { email },
  });
  return user;
}

export type SuspendResult = {
  name: string;
  stopped: number;
  failed: { configId: string; reason: string }[];
};

/**
 * Suspending cuts access, so it disables every live tunnel the person holds — a suspended user
 * whose VPN still works is not suspended. Each config is a separate node call, so a partial
 * failure is reported rather than swallowed: the caller says what survived.
 */
export async function suspendUser(input: { userId: string }): Promise<SuspendResult> {
  const staff = await actingStaff('admin');

  const user = await db.user.update({
    where: { id: input.userId },
    data: { status: 'suspended' },
    include: { configs: { where: { status: 'active' }, select: { id: true } } },
  });

  const failed: SuspendResult['failed'] = [];
  let stopped = 0;
  for (const config of user.configs) {
    try {
      await disableConfig({ configId: config.id });
      stopped += 1;
    } catch (error) {
      failed.push({ configId: config.id, reason: error instanceof Error ? error.message : 'unknown' });
    }
  }

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.userSuspend,
    target: user.id,
    detail: { stopped, failed: failed.length },
  });

  return { name: user.name ?? user.email, stopped, failed };
}

/**
 * Reactivating restores the account but deliberately does NOT re-enable tunnels — access is
 * granted back per config, on purpose, so nobody silently regains every tunnel they once had.
 */
export async function reactivateUser(input: { userId: string }) {
  const staff = await actingStaff('admin');
  const user = await db.user.update({ where: { id: input.userId }, data: { status: 'active' } });
  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.userReactivate,
    target: user.id,
  });
  return user;
}

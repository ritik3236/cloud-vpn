import 'server-only';

import { clerkClient, type User as ClerkUser } from '@clerk/nextjs/server';

import { roleFromMetadata } from '@/auth/roles';
import { personLabel } from '@/lib/person';
import { AUDIT_ACTIONS, recordAudit } from '@/server/audit';
import { disableConfig } from '@/server/configs/lifecycle';
import { db } from '@/server/db';
import { actingStaff } from '@/server/staff';

import { mirrorPeople, mirrorPerson, type ClerkPerson } from './mirror';

export type { ClerkPerson } from './mirror';

export class SelfSuspendError extends Error {
  constructor() {
    super('You cannot suspend your own account — ask another admin.');
    this.name = 'SelfSuspendError';
  }
}

const PAGE = 500;
const THROTTLE_MS = 15_000;
let lastSync: { at: number; people: ClerkPerson[] } | undefined;

function toPerson(user: ClerkUser): ClerkPerson {
  return {
    clerkId: user.id,
    username: user.username,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
    email:
      user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ??
      null,
    banned: user.banned,
    role: roleFromMetadata(user.publicMetadata),
    createdAt: new Date(user.createdAt),
    lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
  };
}

/**
 * Refreshes the mirror from Clerk, the source of truth for who exists (SPEC §2). Writes only rows
 * that are new or changed, so a steady state costs one or two list calls and one query.
 *
 * Throttled because the configs and users pages both call it and an admin moving between them
 * should not re-list every user each time. `force` skips the throttle after a mutation.
 *
 * Returns `null` when Clerk could not be reached, so a dashboard that already has its own rows
 * can show them as last synced instead of failing — or worse, reporting that everyone is gone.
 */
export async function syncUsersFromClerk({ force = false } = {}): Promise<ClerkPerson[] | null> {
  if (!force && lastSync && Date.now() - lastSync.at < THROTTLE_MS) return lastSync.people;

  const people: ClerkPerson[] = [];
  try {
    const client = await clerkClient();
    for (let offset = 0; ; offset += PAGE) {
      const page = await client.users.getUserList({ limit: PAGE, offset });
      people.push(...page.data.map(toPerson));
      if (page.data.length < PAGE) break;
    }
  } catch (error) {
    console.error('[users] could not list Clerk users', error);
    return null;
  }

  await mirrorPeople(people);

  lastSync = { at: Date.now(), people };
  return people;
}

/** Mirrors one Clerk user — used on first sign-in, before any sync has seen them. */
export async function mirrorClerkUser(user: ClerkUser) {
  return mirrorPerson(toPerson(user));
}

/**
 * Deleting someone in Clerk leaves their mirror row (and their tunnels) behind, so a ban aimed at
 * a user Clerk no longer has must not abort the half that actually cuts access.
 */
async function setClerkBan(clerkId: string, banned: boolean): Promise<boolean> {
  const client = await clerkClient();
  try {
    if (banned) await client.users.banUser(clerkId);
    else await client.users.unbanUser(clerkId);
    return true;
  } catch (error) {
    if ((error as { status?: number } | null)?.status === 404) return false;
    throw error;
  }
}

export type SuspendResult = {
  label: string;
  stopped: number;
  failed: { configId: string; reason: string }[];
};

/**
 * Bans the person in Clerk — which signs them out everywhere and blocks sign-in, so Clerk stays
 * the one place that decides who is allowed in — and disables every live tunnel they hold. A
 * suspended user whose VPN still works is not suspended.
 *
 * Each tunnel is a separate node call, so a partial failure is reported, never swallowed.
 */
export async function suspendUser(input: { userId: string }): Promise<SuspendResult> {
  const staff = await actingStaff('admin');

  const user = await db.user.findUniqueOrThrow({
    where: { id: input.userId },
    include: { configs: { where: { status: 'active' }, select: { id: true } } },
  });
  if (user.clerkId && user.clerkId === staff.clerkId) throw new SelfSuspendError();

  const banned = user.clerkId ? await setClerkBan(user.clerkId, true) : false;
  await db.user.update({ where: { id: user.id }, data: { status: 'suspended' } });

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
    detail: { stopped, failed: failed.length, banned },
  });
  lastSync = undefined;

  return {
    label: personLabel(user),
    stopped,
    failed,
  };
}

/**
 * Lifts the Clerk ban so they can sign in again, but deliberately leaves tunnels off — access is
 * restored per config, so nobody silently regains every tunnel they once had.
 */
export async function reactivateUser(input: { userId: string }) {
  const staff = await actingStaff('admin');
  const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });

  if (user.clerkId) await setClerkBan(user.clerkId, false);
  const updated = await db.user.update({ where: { id: user.id }, data: { status: 'active' } });

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.userReactivate,
    target: user.id,
  });
  lastSync = undefined;
  return updated;
}

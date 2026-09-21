import 'server-only';

import { auth, currentUser } from '@clerk/nextjs/server';

import { AUDIT_ACTIONS, recordAudit } from '@/server/audit';
import { decrypt } from '@/server/crypto';
import { db } from '@/server/db';
import { mirrorClerkUser } from '@/server/users';
import { renderClientConfig } from '@/server/wireguard';

export class NotAMemberError extends Error {
  constructor() {
    super('This account is not on the list yet. Ask an admin to add you.');
    this.name = 'NotAMemberError';
  }
}

export class SuspendedError extends Error {
  constructor() {
    super('Your access is suspended. Ask an admin to restore it.');
    this.name = 'SuspendedError';
  }
}

export class ConfigUnavailableError extends Error {
  constructor() {
    super('That config is not available.');
    this.name = 'ConfigUnavailableError';
  }
}

/**
 * The signed-in person's mirror row, keyed by Clerk id. Clerk is the source of truth and sign-up
 * is restricted, so anyone who can sign in was created by an admin — the first visit simply
 * mirrors them. Nothing is matched on email, so there is no address to spoof.
 */
export async function resolveCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const linked = await db.user.findUnique({ where: { clerkId: userId } });
  if (linked) return linked;

  const clerk = await currentUser();
  return clerk ? mirrorClerkUser(clerk) : null;
}

/** Everything the signed-in person is allowed to see: their own configs, and nothing else. */
export async function myConfigs() {
  const user = await resolveCurrentUser();
  if (!user) throw new NotAMemberError();

  const configs = await db.config.findMany({
    where: { userId: user.id, status: { in: ['active', 'disabled'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      deviceLabel: true,
      assignedIp: true,
      createdAt: true,
      sourceType: true,
      node: { select: { name: true, region: true } },
      externalSource: { select: { name: true } },
    },
  });

  return { user, configs };
}

/**
 * The one place a non-admin touches key material. Ownership is checked against the signed-in
 * identity, and a config belonging to someone else returns the same error as one that does not
 * exist — otherwise the difference between the two would confirm an id by probing.
 */
export async function getOwnConfigFile(configId: string): Promise<{ filename: string; content: string }> {
  const user = await resolveCurrentUser();
  if (!user) throw new NotAMemberError();
  if (user.status !== 'active') throw new SuspendedError();

  const config = await db.config.findUnique({
    where: { id: configId },
    include: { node: true, externalSource: true },
  });
  if (!config || config.userId !== user.id) throw new ConfigUnavailableError();
  if (config.status !== 'active') throw new ConfigUnavailableError();

  let content: string;
  if (config.sourceType === 'static') {
    if (!config.encryptedConf) throw new ConfigUnavailableError();
    content = decrypt(config.encryptedConf);
  } else {
    if (!config.node || !config.encryptedPrivkey || !config.assignedIp) {
      throw new ConfigUnavailableError();
    }
    content = renderClientConfig({
      privateKey: decrypt(config.encryptedPrivkey),
      address: config.assignedIp,
      dns: config.node.dns,
      nodePublicKey: config.node.nodePubkey,
      endpoint: config.node.endpoint,
      allowedIps: config.allowedIps,
    });
  }

  // Recorded like any other retrieval — this is also what tells an admin the key has been
  // delivered when they later consider returning the config to the pool.
  await recordAudit({
    actorId: user.clerkId,
    action: AUDIT_ACTIONS.configView,
    target: config.id,
    detail: { self: true },
  });

  const slug = [config.node?.name ?? config.externalSource?.name, config.deviceLabel ?? config.assignedIp]
    .filter(Boolean)
    .join('-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .toLowerCase();

  return { filename: `${slug || 'wireguard'}.conf`, content };
}

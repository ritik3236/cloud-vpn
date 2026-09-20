import 'server-only';

import type { Config, Node } from '@prisma/client';

import { api, type AgentTarget } from '@/api';
import { AUDIT_ACTIONS, recordAudit } from '@/server/audit';
import { decrypt, encrypt } from '@/server/crypto';
import { db } from '@/server/db';
import { allocateIp, releaseIp } from '@/server/ipam';
import { actingStaff } from '@/server/staff';
import { generateKeypair, peerAllowedIp, renderClientConfig } from '@/server/wireguard';

export class ConfigStateError extends Error {
  constructor(configId: string, status: string, action: string) {
    super(`config ${configId} is ${status} — cannot ${action}`);
    this.name = 'ConfigStateError';
  }
}

type ConfigWithNode = Config & { node: Node | null };

const load = (configId: string) =>
  db.config.findUniqueOrThrow({ where: { id: configId }, include: { node: true } });

const agentTargetFor = (node: Node): AgentTarget => ({
  nodeId: node.id,
  baseUrl: node.agentUrl,
  token: decrypt(node.agentToken),
  cert: node.agentCert,
});

/**
 * The peer-management parts of a managed config, or null for a static one — the static driver
 * has no peer to add or remove, so every operation below reduces to its DB half (SPEC §6).
 */
function managedParts(config: ConfigWithNode): { node: Node; pubkey: string; assignedIp: string } | null {
  if (config.sourceType !== 'managed') return null;
  if (!config.node || !config.pubkey || !config.assignedIp) {
    throw new Error(`managed config ${config.id} is missing node, pubkey or assignedIp`);
  }
  return { node: config.node, pubkey: config.pubkey, assignedIp: config.assignedIp };
}

/** Generate a spare: keypair + reserved IP, no node call. Inert until assigned (SPEC §5). */
export async function generateConfig(input: { nodeId: string; deviceLabel?: string }) {
  const staff = await actingStaff('admin');
  const node = await db.node.findUniqueOrThrow({ where: { id: input.nodeId } });
  const keypair = generateKeypair();

  const config = await db.$transaction(async (tx) => {
    const created = await tx.config.create({
      data: {
        sourceType: 'managed',
        status: 'unassigned',
        nodeId: node.id,
        deviceLabel: input.deviceLabel,
        pubkey: keypair.publicKey,
        encryptedPrivkey: encrypt(keypair.privateKey),
        issuedById: staff.id,
      },
    });
    const ip = await allocateIp(tx, {
      nodeId: node.id,
      cidrPool: node.cidrPool,
      configId: created.id,
    });
    return tx.config.update({ where: { id: created.id }, data: { assignedIp: ip } });
  });

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.configGenerate,
    target: config.id,
    detail: { nodeId: node.id, ip: config.assignedIp },
  });
  return config;
}

/** Assign to a user — this is what makes the tunnel live. DB first, agent second, revert on failure. */
export async function assignConfig(input: { configId: string; userId: string }) {
  const staff = await actingStaff('admin');
  const config = await load(input.configId);
  if (config.status !== 'unassigned') {
    throw new ConfigStateError(config.id, config.status, 'assign');
  }

  const before = { userId: config.userId, status: config.status, assignedAt: config.assignedAt };
  const updated = await db.config.update({
    where: { id: config.id },
    data: { userId: input.userId, status: 'active', assignedAt: new Date() },
  });

  const managed = managedParts(config);
  if (managed) {
    try {
      await api.agent.addPeer(agentTargetFor(managed.node), {
        pubkey: managed.pubkey,
        allowed_ip: peerAllowedIp(managed.assignedIp),
      });
    } catch (err) {
      await db.config.update({ where: { id: config.id }, data: before });
      throw err;
    }
  }

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.configAssign,
    target: config.id,
    detail: { userId: input.userId },
  });
  return updated;
}

/**
 * Return a config to the pool. The caller is warned when the key has been retrieved before —
 * but not blocked: the audit log is a proxy for delivery, not proof of it, and refusing a
 * legitimate action on a guess is worse than letting an admin make an informed call. The
 * retrieval count goes into the audit entry so the decision is on the record.
 */
export async function unassignConfig(input: { configId: string }) {
  const staff = await actingStaff('admin');
  const config = await load(input.configId);
  if (config.status !== 'active') {
    throw new ConfigStateError(config.id, config.status, 'unassign');
  }

  const retrievals = await db.auditLog.count({
    where: { action: AUDIT_ACTIONS.configView, target: config.id },
  });

  const managed = managedParts(config);
  if (managed) {
    await api.agent.removePeer(agentTargetFor(managed.node), { pubkey: managed.pubkey });
  }

  const updated = await db.config.update({
    where: { id: config.id },
    data: { userId: null, status: 'unassigned', assignedAt: null },
  });
  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.configUnassign,
    target: config.id,
    detail: { retrievalsBefore: retrievals },
  });
  return updated;
}

/** Reversible kill switch. Agent first — never claim a tunnel is down until it is. IP is held. */
export async function disableConfig(input: { configId: string }) {
  const staff = await actingStaff('admin', 'ops');
  const config = await load(input.configId);
  if (config.status !== 'active') {
    throw new ConfigStateError(config.id, config.status, 'disable');
  }

  const managed = managedParts(config);
  if (managed) {
    await api.agent.removePeer(agentTargetFor(managed.node), { pubkey: managed.pubkey });
  }

  const updated = await db.config.update({
    where: { id: config.id },
    data: { status: 'disabled', disabledAt: new Date() },
  });
  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.configDisable,
    target: config.id,
  });
  return updated;
}

/** Re-add the SAME pubkey and IP, so the user's original file resumes working (SPEC §5). */
export async function enableConfig(input: { configId: string }) {
  const staff = await actingStaff('admin', 'ops');
  const config = await load(input.configId);
  if (config.status !== 'disabled') {
    throw new ConfigStateError(config.id, config.status, 'enable');
  }

  const updated = await db.config.update({
    where: { id: config.id },
    data: { status: 'active', disabledAt: null },
  });

  const managed = managedParts(config);
  if (managed) {
    try {
      await api.agent.addPeer(agentTargetFor(managed.node), {
        pubkey: managed.pubkey,
        allowed_ip: peerAllowedIp(managed.assignedIp),
      });
    } catch (err) {
      await db.config.update({
        where: { id: config.id },
        data: { status: 'disabled', disabledAt: config.disabledAt },
      });
      throw err;
    }
  }

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.configEnable,
    target: config.id,
  });
  return updated;
}

/** Terminal. Agent first, then soft-delete the record and return the IP to the pool. */
export async function revokeConfig(input: { configId: string }) {
  const staff = await actingStaff('admin', 'ops');
  const config = await load(input.configId);
  if (config.status === 'revoked') {
    throw new ConfigStateError(config.id, config.status, 'revoke');
  }

  const managed = managedParts(config);
  if (managed) {
    await api.agent.removePeer(agentTargetFor(managed.node), { pubkey: managed.pubkey });
  }

  const updated = await db.$transaction(async (tx) => {
    await releaseIp(tx, config.id);
    return tx.config.update({
      where: { id: config.id },
      data: { status: 'revoked', revokedAt: new Date() },
    });
  });

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.configRevoke,
    target: config.id,
  });
  return updated;
}

/**
 * Hand a device to a different user. Never transfers the old key — the previous holder still has
 * the file, and two devices on one key flap the handshake (SPEC §5, §12). Revoke + fresh issue,
 * linked by `replaced_by_id` so the audit trail reads as a hand-over rather than a plain revoke.
 */
export async function reassignConfig(input: { configId: string; toUserId: string }) {
  const staff = await actingStaff('admin');
  const original = await load(input.configId);
  if (!original.nodeId) {
    throw new Error(`config ${original.id} has no node to reassign on`);
  }

  await revokeConfig({ configId: original.id });

  const replacement = await generateConfig({
    nodeId: original.nodeId,
    deviceLabel: original.deviceLabel ?? undefined,
  });
  await assignConfig({ configId: replacement.id, userId: input.toUserId });

  await db.config.update({
    where: { id: original.id },
    data: { replacedById: replacement.id },
  });
  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.configReassign,
    target: original.id,
    detail: { replacedBy: replacement.id, toUserId: input.toUserId },
  });

  return db.config.findUniqueOrThrow({ where: { id: replacement.id } });
}

/**
 * Admin-only key retrieval (SPEC §2). Rebuilt from `encrypted_privkey` rather than stored whole,
 * and every call is audited — the audit row is also what `unassignConfig` reads as delivery.
 */
export async function getConfigFile(input: { configId: string }): Promise<string> {
  const staff = await actingStaff('admin');
  const config = await load(input.configId);

  const managed = managedParts(config);
  const file = managed
    ? renderClientConfig({
        privateKey: decrypt(config.encryptedPrivkey ?? ''),
        address: managed.assignedIp,
        dns: managed.node.dns,
        nodePublicKey: managed.node.nodePubkey,
        endpoint: managed.node.endpoint,
        allowedIps: config.allowedIps,
      })
    : decrypt(config.encryptedConf ?? '');

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.configView,
    target: config.id,
  });
  return file;
}

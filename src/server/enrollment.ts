import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { AUDIT_ACTIONS, recordAudit } from '@/server/audit';
import { encrypt } from '@/server/crypto';
import { db } from '@/server/db';
import { poolContains, poolRange } from '@/server/ipam';
import { probeNodeAgent } from '@/server/nodes';
import { actingStaff } from '@/server/staff';

const TOKEN_TTL_MS = 60 * 60 * 1000;
const PREFIX = 'cvpn_';

export class EnrollmentError extends Error {
  constructor(
    readonly code: 'invalid' | 'used' | 'expired' | 'preflight' | 'duplicate',
    message: string,
  ) {
    super(message);
    this.name = 'EnrollmentError';
  }
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Mints a single-use enrollment secret. The admin supplies the human details now; the node
 * supplies its key, certificate and endpoint when it enrolls — so no secret is ever read off
 * the box and typed into a form.
 */
export async function createEnrollmentToken(input: {
  name: string;
  region: string;
  provider: string;
  cidrPool: string;
  dns: string;
}) {
  const staff = await actingStaff('admin');
  poolRange(input.cidrPool); // fail here, not an hour later when the node calls back

  const token = PREFIX + randomBytes(24).toString('base64url');
  const record = await db.enrollmentToken.create({
    data: {
      tokenHash: hash(token),
      name: input.name.trim(),
      region: input.region.trim(),
      provider: input.provider.trim(),
      cidrPool: input.cidrPool.trim(),
      dns: input.dns.trim(),
      createdById: staff.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.nodeEnrollToken,
    target: record.id,
    detail: { name: record.name },
  });

  // Returned once and never stored in plaintext — the row only holds its hash.
  return { token, expiresAt: record.expiresAt, name: record.name };
}

/**
 * Called by the node itself, authenticated only by the enrollment secret. The node is still
 * probed before it is trusted: the same preflight the manual path used, so a node that cannot
 * route is refused here too rather than registered and discovered broken later.
 */
export async function enrollNode(input: {
  token: string;
  endpoint: string;
  agentUrl: string;
  agentToken: string;
  agentCert: string;
  /** The adopted interface's own address, when the node already ran WireGuard. */
  interfaceAddress?: string;
}) {
  const candidates = await db.enrollmentToken.findMany({
    where: { usedAt: null },
    select: { id: true, tokenHash: true },
  });

  // Constant-time compare against each live hash so a timing signal cannot confirm a guess.
  const supplied = Buffer.from(hash(input.token));
  const match = candidates.find((row) => {
    const stored = Buffer.from(row.tokenHash);
    return stored.length === supplied.length && timingSafeEqual(stored, supplied);
  });
  if (!match) throw new EnrollmentError('invalid', 'that enrollment token is not valid');

  const record = await db.enrollmentToken.findUniqueOrThrow({ where: { id: match.id } });
  if (record.usedAt) throw new EnrollmentError('used', 'that enrollment token was already used');
  if (record.expiresAt < new Date()) {
    throw new EnrollmentError('expired', 'that enrollment token has expired — generate another');
  }

  // Deleting the manual path took this check with it. The bearer token travels on every agent
  // call, so a plaintext agent URL would put it on the wire in the clear.
  let parsed: URL;
  try {
    parsed = new URL(input.agentUrl);
  } catch {
    throw new EnrollmentError('preflight', 'agent_url must be an absolute URL');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new EnrollmentError('preflight', 'agent_url must be https');
  }
  if (!input.agentCert.includes('BEGIN CERTIFICATE')) {
    throw new EnrollmentError('preflight', 'agent_cert must be a PEM certificate');
  }

  if (await db.node.findUnique({ where: { name: record.name } })) {
    throw new EnrollmentError(
      'duplicate',
      `a node called ${record.name} is already registered — remove it first, or enroll under a different name`,
    );
  }

  // An adopted node keeps its own interface. If that sits outside the declared pool, every
  // config issued for it would carry an address the node does not route.
  if (input.interfaceAddress && !poolContains(record.cidrPool, input.interfaceAddress)) {
    throw new EnrollmentError(
      'preflight',
      `the node's interface is ${input.interfaceAddress}, which is outside the pool ${record.cidrPool} you declared`,
    );
  }

  const probe = await probeNodeAgent(input.agentUrl, input.agentToken, input.agentCert);
  if (!probe.reachable || probe.problems.length > 0 || !probe.nodePubkey) {
    throw new EnrollmentError('preflight', probe.problems.join('; ') || 'the agent did not answer');
  }

  const node = await db.node.create({
    data: {
      name: record.name,
      region: record.region,
      provider: record.provider,
      cidrPool: record.cidrPool,
      dns: record.dns,
      endpoint: input.endpoint,
      agentUrl: input.agentUrl,
      nodePubkey: probe.nodePubkey,
      agentToken: encrypt(input.agentToken),
      agentCert: input.agentCert,
    },
  });

  await db.enrollmentToken.update({
    where: { id: record.id },
    data: { usedAt: new Date(), nodeId: node.id },
  });
  await recordAudit({
    actorId: null,
    action: AUDIT_ACTIONS.nodeCreate,
    target: node.id,
    detail: { name: node.name, enrolled: true },
  });

  return node;
}

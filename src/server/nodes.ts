import 'server-only';

import { api, AgentError } from '@/api';
import { AUDIT_ACTIONS, recordAudit } from '@/server/audit';
import { encrypt } from '@/server/crypto';
import { db } from '@/server/db';
import { poolRange } from '@/server/ipam';
import { actingStaff } from '@/server/staff';

export class InvalidNodeInput extends Error {
  constructor(field: string, detail: string) {
    super(`${field}: ${detail}`);
    this.name = 'InvalidNodeInput';
  }
}

export class NodePreflightError extends Error {
  constructor(
    readonly problems: string[],
    name: string,
  ) {
    super(`node ${name} failed preflight:\n- ${problems.join('\n- ')}`);
    this.name = 'NodePreflightError';
  }
}

export class NodeInUseError extends Error {
  constructor(nodeId: string, configs: number) {
    super(`node ${nodeId} still has ${configs} live config(s); revoke them before removing it`);
    this.name = 'NodeInUseError';
  }
}

export type NodeProbe = {
  reachable: boolean;
  nodePubkey: string | null;
  ipForward: boolean | null;
  srcValidMark: boolean | null;
  problems: string[];
};

async function probe(agentUrl: string, agentToken: string): Promise<NodeProbe> {
  try {
    const health = await api.agent.health(
      { nodeId: 'unregistered', baseUrl: agentUrl, token: agentToken },
      {},
    );

    const problems: string[] = [];
    if (health.status !== 'ok') problems.push('the agent reports itself degraded');
    if (!health.wg_up) problems.push('the WireGuard interface is not listening');

    // The SPEC §12 trap, checked rather than remembered. A container can accept peers and
    // still forward nothing, which presents as "the VPN connects but no traffic works" —
    // a support ticket days later instead of a refusal now.
    if (health.ip_forward === false) {
      problems.push('net.ipv4.ip_forward is 0 — the node would accept peers but route nothing');
    }
    if (health.src_valid_mark === false) {
      problems.push('net.ipv4.conf.all.src_valid_mark is 0 — return traffic would be dropped');
    }

    return {
      reachable: true,
      nodePubkey: health.node_pubkey,
      ipForward: health.ip_forward ?? null,
      srcValidMark: health.src_valid_mark ?? null,
      problems,
    };
  } catch (err) {
    if (err instanceof AgentError) {
      return {
        reachable: false,
        nodePubkey: null,
        ipForward: null,
        srcValidMark: null,
        problems: [`agent unreachable (${err.code}): ${err.message}`],
      };
    }
    throw err;
  }
}

/** Dry run for the Add Node form — same checks as `createNode`, without writing anything. */
export async function probeNode(input: { agentUrl: string; agentToken: string }) {
  await actingStaff('admin');
  return probe(input.agentUrl, input.agentToken);
}

function assertEndpoint(endpoint: string) {
  const match = /^(\S+):(\d{1,5})$/.exec(endpoint);
  if (!match) throw new InvalidNodeInput('endpoint', 'must be host:port, e.g. 1.2.3.4:51820');
  const port = Number(match[2]);
  if (port < 1 || port > 65535) throw new InvalidNodeInput('endpoint', `port ${port} is out of range`);
}

function assertAgentUrl(agentUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(agentUrl);
  } catch {
    throw new InvalidNodeInput('agentUrl', 'must be an absolute URL');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new InvalidNodeInput('agentUrl', 'must be https — the bearer token travels on every call');
  }
}

/**
 * Register a node (SPEC §10 step 4). The agent must already be running: onboarding verifies it
 * end to end rather than trusting the form, so a node is either usable the moment it is listed
 * or never listed at all.
 */
export async function createNode(input: {
  name: string;
  region: string;
  provider: string;
  endpoint: string;
  cidrPool: string;
  dns: string;
  agentUrl: string;
  agentToken: string;
}) {
  const staff = await actingStaff('admin');

  assertEndpoint(input.endpoint);
  assertAgentUrl(input.agentUrl);
  const { first, last } = poolRange(input.cidrPool);

  const result = await probe(input.agentUrl, input.agentToken);
  if (!result.reachable || result.problems.length > 0 || !result.nodePubkey) {
    throw new NodePreflightError(result.problems, input.name);
  }

  const node = await db.node.create({
    data: {
      name: input.name,
      region: input.region,
      provider: input.provider,
      endpoint: input.endpoint,
      cidrPool: input.cidrPool,
      dns: input.dns,
      agentUrl: input.agentUrl,
      // Read from the agent, never typed by a human. A mistyped node public key yields a config
      // that looks entirely correct and silently never completes a handshake.
      nodePubkey: result.nodePubkey,
      agentToken: encrypt(input.agentToken),
    },
  });

  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.nodeCreate,
    target: node.id,
    detail: { name: node.name, endpoint: node.endpoint, capacity: last - first + 1 },
  });
  return node;
}

/**
 * Soft removal — the row survives so revoked configs keep their foreign key and the audit trail
 * stays readable (SPEC §9). A node holding live configs is refused rather than silently
 * stranding the people using it.
 */
export async function removeNode(input: { nodeId: string }) {
  const staff = await actingStaff('admin');

  const live = await db.config.count({
    where: { nodeId: input.nodeId, status: { in: ['unassigned', 'active', 'disabled'] } },
  });
  if (live > 0) throw new NodeInUseError(input.nodeId, live);

  const node = await db.node.update({
    where: { id: input.nodeId },
    data: { status: 'disabled' },
  });
  await recordAudit({
    actorId: staff.clerkId,
    action: AUDIT_ACTIONS.nodeDelete,
    target: node.id,
    detail: { name: node.name },
  });
  return node;
}

import 'server-only';

import { api, AgentError } from '@/api';
import { AUDIT_ACTIONS, recordAudit } from '@/server/audit';
import { db } from '@/server/db';
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

export async function probeNodeAgent(
  agentUrl: string,
  agentToken: string,
  agentCert: string,
): Promise<NodeProbe> {
  try {
    const health = await api.agent.health(
      { nodeId: 'unregistered', baseUrl: agentUrl, token: agentToken, cert: agentCert },
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

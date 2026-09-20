import 'server-only';

import { api } from '@/api';
import { decrypt } from '@/server/crypto';
import { db } from '@/server/db';

export type ConfigUsage = {
  lastHandshake: number | null;
  rxBytes: number;
  txBytes: number;
};

/**
 * Live transfer counters, read from the nodes themselves — the control plane stores no usage
 * history, so this is the current state of each peer rather than a total over time.
 *
 * One call per node, not per config. A node that cannot be reached is simply absent from the
 * result: usage is peripheral, and a node being down must not take the page down with it.
 */
export async function usageByConfig(
  configs: { id: string; pubkey: string | null; nodeId: string | null }[],
): Promise<Map<string, ConfigUsage>> {
  const byNode = new Map<string, { configId: string; pubkey: string }[]>();
  for (const config of configs) {
    if (!config.nodeId || !config.pubkey) continue;
    const list = byNode.get(config.nodeId) ?? [];
    list.push({ configId: config.id, pubkey: config.pubkey });
    byNode.set(config.nodeId, list);
  }
  if (byNode.size === 0) return new Map();

  const nodes = await db.node.findMany({ where: { id: { in: [...byNode.keys()] } } });
  const usage = new Map<string, ConfigUsage>();

  await Promise.all(
    nodes.map(async (node) => {
      try {
        const { peers } = await api.agent.listPeers(
          {
            nodeId: node.id,
            baseUrl: node.agentUrl,
            token: decrypt(node.agentToken),
            cert: node.agentCert,
          },
          {},
        );
        const byPubkey = new Map(peers.map((peer) => [peer.pubkey, peer]));
        for (const { configId, pubkey } of byNode.get(node.id) ?? []) {
          const peer = byPubkey.get(pubkey);
          if (!peer) continue;
          usage.set(configId, {
            lastHandshake: peer.last_handshake ?? null,
            rxBytes: peer.rx_bytes ?? 0,
            txBytes: peer.tx_bytes ?? 0,
          });
        }
      } catch {
        // Degrade to "unavailable" for this node's configs rather than failing the page.
      }
    }),
  );

  return usage;
}

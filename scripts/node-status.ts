/**
 * Shows every registered node and whether the control plane can actually reach its agent —
 * including whether the node's live WireGuard key still matches what the database recorded.
 *
 *   pnpm node:status
 */
async function main() {
  process.loadEnvFile('.env.local');
  const { db } = await import('../src/server/db');
  const { decrypt } = await import('../src/server/crypto');
  const { api } = await import('../src/api');

  const nodes = await db.node.findMany({ include: { _count: { select: { configs: true } } } });
  if (nodes.length === 0) {
    console.log('no nodes registered');
    process.exit(0);
  }

  for (const node of nodes) {
    console.log(`\n${node.name}  [${node.status}]  ${node.region} · ${node.provider}`);
    console.log(`  endpoint ${node.endpoint}   pool ${node.cidrPool}   configs ${node._count.configs}`);
    try {
      const health = await api.agent.health(
        {
          nodeId: node.id,
          baseUrl: node.agentUrl,
          token: decrypt(node.agentToken),
          cert: node.agentCert,
        },
        {},
      );
      const keyMatches = health.node_pubkey === node.nodePubkey;
      console.log(`  agent    ${health.status}  wg_up=${health.wg_up}  ip_forward=${health.ip_forward}  src_valid_mark=${health.src_valid_mark}`);
      console.log(`  key      ${keyMatches ? 'matches the database' : 'DRIFTED from the database'}`);
    } catch (error) {
      console.log(`  agent    UNREACHABLE (${error instanceof Error ? error.message : error})`);
    }
  }
  process.exit(0);
}

main();

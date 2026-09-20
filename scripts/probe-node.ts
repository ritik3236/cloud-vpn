/**
 * Drive a real node agent through the control plane's own api/ client, so the zod contracts are
 * validated against live agent responses rather than against a fixture.
 *
 *   AGENT_URL=http://localhost:51821 AGENT_TOKEN=... pnpm probe:node
 */
import { api, AgentError, type AgentTarget } from '../src/api';
import { generateKeypair } from '../src/server/wireguard';

const target: AgentTarget = {
  nodeId: 'probe',
  baseUrl: process.env.AGENT_URL ?? 'http://localhost:51821',
  token: process.env.AGENT_TOKEN ?? '',
};

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function main() {
  const health = await api.agent.health(target, {});
  check('health validates against the contract', health.status === 'ok', `node_pubkey=${health.node_pubkey.slice(0, 12)}…`);
  check('agent reports ip_forward', health.ip_forward === true);
  check('agent reports src_valid_mark', health.src_valid_mark === true);

  const before = await api.agent.listPeers(target, {});
  const keypair = generateKeypair();

  await api.agent.addPeer(target, { pubkey: keypair.publicKey, allowed_ip: '10.8.0.7/32' });
  const added = await api.agent.listPeers(target, {});
  const peer = added.peers.find((p) => p.pubkey === keypair.publicKey);
  check('peer added and listed', Boolean(peer), `peers ${before.peers.length} -> ${added.peers.length}`);
  check('allowed_ip round-trips', peer?.allowed_ip === '10.8.0.7/32', peer?.allowed_ip ?? 'missing');
  check('never-handshaked reports null', peer?.last_handshake == null);

  // The base64url path encoding is exercised here against a real router, not a mock.
  await api.agent.removePeer(target, { pubkey: keypair.publicKey });
  const after = await api.agent.listPeers(target, {});
  check('peer removed', !after.peers.some((p) => p.pubkey === keypair.publicKey), `peers back to ${after.peers.length}`);

  try {
    await api.agent.health({ ...target, token: 'wrong-token' }, {});
    check('bad token is rejected', false, 'call unexpectedly succeeded');
  } catch (err) {
    check('bad token is rejected', err instanceof AgentError && err.code === 'unauthorized');
  }

  console.log(failures ? `\n${failures} FAILED` : '\ncontrol plane <-> agent contract holds');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('probe failed:', err instanceof AgentError ? `${err.code}: ${err.message}` : err);
  process.exit(1);
});

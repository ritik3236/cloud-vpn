/**
 * Sanity checks for the pieces of the config lifecycle that are pure enough to run without a
 * node agent or a Clerk session. Run: pnpm check:primitives
 */
import { createPrivateKey, createPublicKey } from 'node:crypto';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// X25519 PKCS8 prefix; the final 32 bytes are the raw scalar.
const PKCS8_X25519 = Buffer.from('302e020100300506032b656e04220420', 'hex');

function derivePublic(privateKeyBase64: string): string {
  const der = Buffer.concat([PKCS8_X25519, Buffer.from(privateKeyBase64, 'base64')]);
  const key = createPublicKey(createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }));
  const { x } = key.export({ format: 'jwk' }) as { x: string };
  return Buffer.from(x, 'base64url').toString('base64');
}

async function main() {
  // Env must be in place before anything imports '@/lib/env', so these load here rather than at
  // the top (a top-level await would make this module async, which tsx cannot require). The
  // react-server condition, set in the package script, is what lets 'server-only' resolve
  // outside Next — see ~/dev-notes/prisma-7-external-tables-neon-auth.md.
  process.loadEnvFile('.env.local');
  const { db } = await import('../src/server/db');
  const { allocateIp, poolRange } = await import('../src/server/ipam');
  const { generateKeypair, peerAllowedIp, renderClientConfig } = await import('../src/server/wireguard');

  // 1. Keys must be 32 raw bytes, and the public key must actually derive from the private one.
  //    If the JWK extraction were wrong these would still look like valid keys, and every
  //    tunnel would fail its handshake with no visible cause.
  const kp = generateKeypair();
  check('private key is 32 bytes', Buffer.from(kp.privateKey, 'base64').length === 32);
  check('public key is 32 bytes', Buffer.from(kp.publicKey, 'base64').length === 32);
  check('public key derives from private key', derivePublic(kp.privateKey) === kp.publicKey);
  check('keypairs are distinct', generateKeypair().publicKey !== kp.publicKey);

  // 2. Pool arithmetic: network, broadcast and the node's own .1 are all excluded.
  const a = poolRange('10.8.0.0/24');
  check('/24 first usable is .2', a.first === ((10 << 24) | (8 << 16) | 2) >>> 0, '(node keeps .1)');
  check('/24 last usable is .254', a.last === ((10 << 24) | (8 << 16) | 254) >>> 0);
  check('/22 yields 1022 usable', poolRange('10.8.0.0/22').last - poolRange('10.8.0.0/22').first + 1 === 1021);
  check('rejects a bad pool', (() => { try { poolRange('10.8.0.0/31'); return false; } catch { return true; } })());

  // 3. Allocation order against the real schema, rolled back so nothing persists.
  //    Counted before and after rather than assumed empty — this suite runs against a real
  //    database that now has nodes in it.
  const nodesBefore = await db.node.count();
  const allocsBefore = await db.ipAllocation.count();
  const allocated: string[] = [];
  await db.$transaction(async (tx) => {
    const node = await tx.node.create({
      data: {
        name: `probe-${Date.now()}`, region: 'sg', provider: 'test', endpoint: '1.2.3.4:51820',
        nodePubkey: 'pk', cidrPool: '10.8.0.0/24', dns: '1.1.1.1',
        agentUrl: 'https://agent.invalid', agentToken: 'enc',
        agentCert: '-----BEGIN CERTIFICATE-----probe-----END CERTIFICATE-----',
      },
    });
    const staff = await tx.staff.create({ data: { clerkId: `probe-${Date.now()}`, role: 'admin' } });
    for (let i = 0; i < 3; i += 1) {
      const cfg = await tx.config.create({
        data: { sourceType: 'managed', nodeId: node.id, issuedById: staff.id, pubkey: `pk-${i}-${Date.now()}` },
      });
      allocated.push(await allocateIp(tx, { nodeId: node.id, cidrPool: node.cidrPool, configId: cfg.id }));
    }
    throw new Error('ROLLBACK');
  }).catch((e: Error) => { if (e.message !== 'ROLLBACK') throw e; });

  check('allocates lowest free addresses in order', allocated.join(',') === '10.8.0.2,10.8.0.3,10.8.0.4', `got ${allocated.join(',')}`);
  check(
    'nothing persisted',
    (await db.node.count()) === nodesBefore && (await db.ipAllocation.count()) === allocsBefore,
    `nodes ${nodesBefore} → ${await db.node.count()}`,
  );

  // 4. The two AllowedIPs must differ: client routes everything, node routes one address.
  const conf = renderClientConfig({
    privateKey: kp.privateKey, address: '10.8.0.2', dns: '1.1.1.1',
    nodePublicKey: 'NODEPUB', endpoint: '1.2.3.4:51820', allowedIps: '0.0.0.0/0',
  });
  check('client config full-tunnels', conf.includes('AllowedIPs = 0.0.0.0/0'));
  check('client address is /32', conf.includes('Address = 10.8.0.2/32'));
  check('node peer route is a single host', peerAllowedIp('10.8.0.2') === '10.8.0.2/32');

  console.log(failures ? `\n${failures} FAILED` : '\nall primitives OK');
  process.exit(failures ? 1 : 0);
}

main();

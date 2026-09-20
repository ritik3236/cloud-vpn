import 'server-only';

import { generateKeyPairSync } from 'node:crypto';

export type WireguardKeypair = { publicKey: string; privateKey: string };

const toStandardBase64 = (base64url: string) => Buffer.from(base64url, 'base64url').toString('base64');

/**
 * Curve25519 keypair, base64 — the format `wg` expects. Pure crypto, no node call (SPEC §5 step 1).
 * The JWK export gives the raw 32-byte scalars directly; DER would need offset arithmetic.
 */
export function generateKeypair(): WireguardKeypair {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const { x } = publicKey.export({ format: 'jwk' }) as { x: string };
  const { d } = privateKey.export({ format: 'jwk' }) as { d: string };
  return { publicKey: toStandardBase64(x), privateKey: toStandardBase64(d) };
}

/**
 * Rebuilt on demand from `encrypted_privkey` + the node's public fields, so only one secret per
 * config is ever stored (SPEC §5).
 *
 * Note the two different AllowedIPs: here it is the CLIENT's, i.e. what the client routes through
 * the tunnel (`0.0.0.0/0` for a full-tunnel exit). The peer entry on the NODE uses the client's
 * single address instead — see `peerAllowedIp`.
 */
export function renderClientConfig(input: {
  privateKey: string;
  address: string;
  dns: string;
  nodePublicKey: string;
  endpoint: string;
  allowedIps: string;
}): string {
  return (
    [
      '[Interface]',
      `PrivateKey = ${input.privateKey}`,
      `Address = ${input.address}/32`,
      `DNS = ${input.dns}`,
      '',
      '[Peer]',
      `PublicKey = ${input.nodePublicKey}`,
      `Endpoint = ${input.endpoint}`,
      `AllowedIPs = ${input.allowedIps}`,
      'PersistentKeepalive = 25',
    ].join('\n') + '\n'
  );
}

/** What the NODE routes to this peer: exactly one address, never the client's AllowedIPs. */
export const peerAllowedIp = (assignedIp: string) => `${assignedIp}/32`;

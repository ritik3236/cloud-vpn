import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';

const KEY = Buffer.from(env.APP_ENCRYPTION_KEY, 'base64');
const IV_BYTES = 12;

/**
 * AES-256-GCM. Guards `configs.encrypted_privkey`, `configs.encrypted_conf` and
 * `nodes.agent_token` (SPEC §9) — everything whose plaintext would hand over a live tunnel.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('ciphertext is malformed');
  const [iv, tag, body] = parts.map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** Constant-time compare for agent tokens and other bearer secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

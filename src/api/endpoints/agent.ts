import { z } from 'zod';

import { defineAgentEndpoint } from '@/api/define-endpoint';

const peer = z.object({
  pubkey: z.string(),
  allowed_ip: z.string(),
  last_handshake: z.number().nullable().optional(),
  rx_bytes: z.number().optional(),
  tx_bytes: z.number().optional(),
});

/** Idempotent per SPEC §7 — re-adding an existing peer is a no-op. */
export const addPeer = defineAgentEndpoint({
  method: 'POST',
  path: '/peers',
  request: z.object({ pubkey: z.string().min(1), allowed_ip: z.string().min(1) }),
  response: z.object({ ok: z.literal(true) }),
});

/**
 * WireGuard keys are base64, so they contain `/` and `+`. Percent-encoding one into a path
 * segment makes correctness depend on how the agent's router treats `%2F` — so the key travels
 * base64url instead, which needs no escaping at all. The agent accepts both.
 */
const toBase64Url = (key: string) => key.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Idempotent per SPEC §7 — removing a peer that is already gone succeeds. */
export const removePeer = defineAgentEndpoint({
  method: 'DELETE',
  path: (input) => `/peers/${toBase64Url(input.pubkey)}`,
  request: z.object({ pubkey: z.string().min(1) }),
  response: z.object({ ok: z.literal(true) }),
});

/** Source of truth for drift detection: diff this against `configs` (SPEC §9). */
export const listPeers = defineAgentEndpoint({
  method: 'GET',
  path: '/peers',
  request: z.object({}),
  response: z.object({ peers: z.array(peer) }),
});

export const health = defineAgentEndpoint({
  method: 'GET',
  path: '/health',
  request: z.object({}),
  response: z.object({
    status: z.enum(['ok', 'degraded']),
    node_pubkey: z.string(),
    wg_up: z.boolean(),
  }),
});

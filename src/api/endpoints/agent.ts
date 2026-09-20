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

/** Idempotent per SPEC §7 — removing a peer that is already gone succeeds. */
export const removePeer = defineAgentEndpoint({
  method: 'DELETE',
  path: (input) => `/peers/${encodeURIComponent(input.pubkey)}`,
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

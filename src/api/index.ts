import { addPeer, health, listPeers, removePeer } from '@/api/endpoints/agent';

export type { AgentTarget } from '@/api/client';
export { AgentError, type AgentErrorCode } from '@/api/errors';

/** The only way to talk to a node agent. Features never `fetch` an agent directly. */
export const api = {
  agent: { addPeer, removePeer, listPeers, health },
} as const;

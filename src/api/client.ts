import { Agent, fetch as undiciFetch, type Dispatcher, type Response } from 'undici';

import { AgentError } from '@/api/errors';

/** One managed node's agent, resolved from the `nodes` row (token decrypted by the caller). */
export type AgentTarget = {
  nodeId: string;
  baseUrl: string;
  token: string;
  /**
   * The node's self-signed certificate (PEM), pinned rather than validated against a public CA.
   * A Let's Encrypt cert per node would publish the entire node inventory to Certificate
   * Transparency logs, which for a privacy VPN is a permanent, public leak.
   */
  cert?: string;
};

const TIMEOUT_MS = 8_000;

// One dispatcher per certificate, reused: building an Agent per request would leak sockets.
const dispatchers = new Map<string, Dispatcher>();

function dispatcherFor(cert: string | undefined): Dispatcher | undefined {
  if (!cert) return undefined;
  let dispatcher = dispatchers.get(cert);
  if (!dispatcher) {
    dispatcher = new Agent({ connect: { ca: cert } });
    dispatchers.set(cert, dispatcher);
  }
  return dispatcher;
}

export async function agentFetch(
  target: AgentTarget,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = new URL(path, target.baseUrl).toString();

  let res: Response;
  try {
    // undici's own fetch, not the global one: Node's built-in fetch bundles its own undici and
    // rejects a dispatcher built by a different version with `invalid onRequestStart method`.
    // One stack end to end avoids that entirely.
    const init: Parameters<typeof undiciFetch>[1] & { dispatcher?: Dispatcher } = {
      method,
      headers: {
        authorization: `Bearer ${target.token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
      dispatcher: dispatcherFor(target.cert),
    };
    res = await undiciFetch(url, init);
  } catch (cause) {
    throw new AgentError('unreachable', target.nodeId, `${method} ${path} failed`, cause);
  }

  if (res.status === 401 || res.status === 403) {
    throw new AgentError('unauthorized', target.nodeId, 'agent rejected the bearer token');
  }
  if (!res.ok) {
    throw new AgentError(
      'agent_error',
      target.nodeId,
      `agent returned ${res.status}`,
      await res.text().catch(() => undefined),
    );
  }

  if (res.status === 204) return undefined;
  return res.json().catch(() => {
    throw new AgentError('bad_response', target.nodeId, 'agent response was not JSON');
  });
}

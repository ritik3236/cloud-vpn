import { AgentError } from '@/api/errors';

/** One managed node's agent, resolved from the `nodes` row (token decrypted by the caller). */
export type AgentTarget = {
  nodeId: string;
  baseUrl: string;
  token: string;
};

const TIMEOUT_MS = 8_000;

export async function agentFetch(
  target: AgentTarget,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = new URL(path, target.baseUrl).toString();

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${target.token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
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

import type { z, ZodTypeAny } from 'zod';

import { agentFetch, type AgentTarget } from '@/api/client';
import { AgentError } from '@/api/errors';
import { logAgentCall } from '@/api/logger';

/**
 * One contract per agent route (SPEC §7). Parsing the *response* is the point: a node agent
 * that drifts fails loudly here instead of silently reporting a revoke that never happened.
 */
export function defineAgentEndpoint<Req extends ZodTypeAny, Res extends ZodTypeAny>(cfg: {
  method: 'GET' | 'POST' | 'DELETE';
  path: string | ((input: z.infer<Req>) => string);
  request: Req;
  response: Res;
}) {
  const call = async (target: AgentTarget, input: z.infer<Req>): Promise<z.infer<Res>> => {
    const parsed = cfg.request.parse(input) as z.infer<Req>;
    const path = typeof cfg.path === 'function' ? cfg.path(parsed) : cfg.path;
    const hasBody = cfg.method === 'POST';
    const started = performance.now();

    try {
      const raw = await agentFetch(target, cfg.method, path, hasBody ? parsed : undefined);
      logAgentCall({
        nodeId: target.nodeId,
        method: cfg.method,
        path,
        status: 200,
        ms: performance.now() - started,
      });

      const result = cfg.response.safeParse(raw);
      if (!result.success) {
        throw new AgentError(
          'bad_response',
          target.nodeId,
          `agent response did not match the contract for ${cfg.method} ${path}`,
          result.error.issues,
        );
      }
      return result.data as z.infer<Res>;
    } catch (err) {
      logAgentCall({
        nodeId: target.nodeId,
        method: cfg.method,
        path,
        status: 'error',
        ms: performance.now() - started,
      });
      throw err;
    }
  };

  return Object.assign(call, { request: cfg.request, response: cfg.response });
}

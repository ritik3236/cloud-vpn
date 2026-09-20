import { AgentError } from '@/api';
import { ForbiddenError, UnauthenticatedError } from '@/auth/roles';
import { ConfigStateError, DeliveredConfigError } from '@/server/configs/lifecycle';
import { PoolExhaustedError } from '@/server/ipam';
import { InvalidNodeInput, NodeInUseError, NodePreflightError } from '@/server/nodes';

/**
 * Turns a thrown error into a sentence a person can act on. Anything unrecognised becomes a
 * generic line — the user never sees a stack trace or a validator's dump, and the real detail
 * stays in the server log where it has context.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof NodePreflightError) {
    return `That node isn't ready: ${error.problems.join('; ')}.`;
  }
  if (error instanceof InvalidNodeInput) return error.message;
  if (error instanceof NodeInUseError) return error.message;
  if (error instanceof DeliveredConfigError) return error.message;
  if (error instanceof ConfigStateError) return error.message;
  if (error instanceof PoolExhaustedError) {
    return 'That node has no addresses left. Revoke some configs or give it a larger pool.';
  }
  if (error instanceof AgentError) {
    return error.code === 'unauthorized'
      ? 'The node rejected our credentials. Its agent token may have been rotated.'
      : 'Could not reach the node agent. The node may be offline.';
  }
  if (error instanceof ForbiddenError) return 'Your role does not allow that.';
  if (error instanceof UnauthenticatedError) return 'Your session expired. Sign in again.';

  console.error('unhandled action error', error);
  return 'Something went wrong. Try again, or check the server logs.';
}

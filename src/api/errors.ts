export type AgentErrorCode =
  | 'unauthorized' // node rejected our bearer token
  | 'unreachable' // network failure or timeout
  | 'agent_error' // agent returned a non-2xx
  | 'bad_response'; // agent returned a shape the contract does not allow

export class AgentError extends Error {
  constructor(
    readonly code: AgentErrorCode,
    readonly nodeId: string,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

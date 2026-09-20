export function logAgentCall(entry: {
  nodeId: string;
  method: string;
  path: string;
  status: number | 'error';
  ms: number;
}) {
  const line = `agent ${entry.method} ${entry.path} node=${entry.nodeId} status=${entry.status} ${Math.round(entry.ms)}ms`;
  if (process.env.NODE_ENV === 'development') console.info(line);
  else console.info(JSON.stringify({ kind: 'agent_call', ...entry }));
}

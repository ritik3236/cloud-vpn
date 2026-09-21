/**
 * Whether a tunnel is carrying traffic *right now* — an observation, not a status. A config can
 * be Active and idle at the same time, and only the node can answer, so this never lives in the
 * database next to `status` (SPEC §5).
 *
 * WireGuard rehandshakes roughly every two minutes while a peer is up, and issued configs set
 * `PersistentKeepalive = 25`, so a handshake inside this window means someone is connected.
 */
const CONNECTED_WITHIN_SECONDS = 180;

export type Connection =
  | { kind: 'connected'; lastHandshake: number }
  | { kind: 'idle'; lastHandshake: number }
  | { kind: 'never' }
  /** The node did not answer, so "not connected" would be a guess. */
  | { kind: 'unknown' }
  /**
   * An external config terminates on the provider's servers. Proton has no API to ask (§6), so
   * this is unknowable — and must be said out loud, because a blank space reads as "not in use".
   */
  | { kind: 'untracked' }
  /** A config with no peer — a spare, a disabled one, a revoked one — cannot be in use. */
  | { kind: 'none' };

export function connectionOf(input: {
  status: string;
  sourceType: string;
  usage: { lastHandshake: number | null } | undefined;
}): Connection {
  if (input.sourceType === 'static') return { kind: 'untracked' };
  if (input.status !== 'active') return { kind: 'none' };
  if (!input.usage) return { kind: 'unknown' };

  const { lastHandshake } = input.usage;
  if (!lastHandshake) return { kind: 'never' };

  const secondsAgo = Date.now() / 1000 - lastHandshake;
  return secondsAgo <= CONNECTED_WITHIN_SECONDS
    ? { kind: 'connected', lastHandshake }
    : { kind: 'idle', lastHandshake };
}

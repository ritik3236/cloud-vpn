import { type Connection } from '@/lib/connection';
import { relativeTime } from '@/lib/format';

/**
 * One reading of a connection for both the admin table and a user's own card. Deliberately
 * quiet: only a live tunnel gets a colour, because that is the state worth spotting.
 *
 * An external config always says *why* it cannot be read. "Not tracked" on its own looks like a
 * missing feature, and a blank space looks like "not connected" — both would misrepresent a
 * tunnel that is very likely up (SPEC §6).
 */
export function ConnectionLine({
  connection,
  provider,
  verbose = false,
}: {
  connection: Connection;
  /** The external provider's name, so the reason names who is not telling us. */
  provider?: string | null;
  verbose?: boolean;
}) {
  if (connection.kind === 'none') return null;

  if (connection.kind === 'connected') {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-tone-live"
        title={`Last handshake ${relativeTime(connection.lastHandshake)}`}
      >
        <span className="size-1.5 rounded-full bg-tone-live" aria-hidden />
        In use now
      </span>
    );
  }

  const who = provider ?? 'The provider';
  const text =
    connection.kind === 'idle'
      ? verbose
        ? `Last used ${relativeTime(connection.lastHandshake)}`
        : `Idle · ${relativeTime(connection.lastHandshake)}`
      : connection.kind === 'never'
        ? 'Never connected'
        : connection.kind === 'unknown'
          ? verbose
            ? 'Cannot tell right now — the server did not answer.'
            : 'Node unreachable'
          : verbose
            ? `We cannot see this one: it runs on ${who}'s servers, and ${who} reports nothing back to us.`
            : `${who} reports nothing to us`;

  return <span className="block text-xs text-muted-foreground">{text}</span>;
}

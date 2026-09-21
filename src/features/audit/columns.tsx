import { Copyable, StatusPill, type Column } from '@/design-system';
import { formatDateTime, relativeTime, truncateId } from '@/lib/format';

/**
 * An id is what the log stores; a name is what an admin reads. Both are kept: the name answers
 * "who did this", and the id stays copyable because it is the thing that survives a rename — or
 * a person being deleted, which is exactly when a label cannot be found.
 */
type Party = { id: string; label: string | null };

export type AuditRow = {
  id: string;
  action: string;
  createdAt: Date;
  target: Party | null;
  actor: Party | null;
};

const TONE: Record<string, 'live' | 'idle' | 'paused' | 'dead'> = {
  'config.generate': 'idle',
  'config.assign': 'live',
  'config.enable': 'live',
  'config.view': 'idle',
  'config.unassign': 'paused',
  'config.disable': 'paused',
  'config.revoke': 'dead',
  'config.reassign': 'paused',
  'node.create': 'live',
  'node.delete': 'dead',
};

function PartyCell({ party, absent }: { party: Party | null; absent: string }) {
  if (!party) return <span className="text-xs text-muted-foreground">{absent}</span>;

  // Nothing to name: show the id alone rather than printing it twice.
  if (!party.label) {
    return <Copyable value={party.id} display={truncateId(party.id, 10, 6)} label="id" />;
  }

  return (
    <div className="min-w-0">
      <div className="truncate text-sm">{party.label}</div>
      <Copyable
        value={party.id}
        display={truncateId(party.id, 8, 4)}
        label="id"
        className="text-[11px] text-muted-foreground"
      />
    </div>
  );
}

export const auditColumns: Column<AuditRow>[] = [
  {
    key: 'action',
    header: 'Action',
    cell: (entry) => <StatusPill tone={TONE[entry.action] ?? 'idle'}>{entry.action}</StatusPill>,
  },
  {
    key: 'target',
    header: 'Target',
    cell: (entry) => <PartyCell party={entry.target} absent="—" />,
  },
  {
    key: 'actor',
    header: 'Actor',
    cell: (entry) => <PartyCell party={entry.actor} absent="System" />,
  },
  {
    key: 'when',
    header: 'When',
    cell: (entry) => (
      <span className="text-xs text-muted-foreground" title={formatDateTime(entry.createdAt)}>
        {relativeTime(entry.createdAt)}
      </span>
    ),
  },
];

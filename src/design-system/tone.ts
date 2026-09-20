/**
 * Raw status vocabularies fold into four tones. The same tone travels from a table cell to a
 * detail view to a toast, so `disabled` is the same colour everywhere it appears.
 */
export type Tone = 'live' | 'idle' | 'paused' | 'dead';

const CONFIG_TONES: Record<string, Tone> = {
  active: 'live',
  unassigned: 'idle',
  disabled: 'paused',
  revoked: 'dead',
};

const NODE_TONES: Record<string, Tone> = {
  active: 'live',
  degraded: 'paused',
  disabled: 'dead',
};

export const configTone = (status: string): Tone => CONFIG_TONES[status] ?? 'idle';
export const nodeTone = (status: string): Tone => NODE_TONES[status] ?? 'idle';

export const TONE_CLASS: Record<Tone, string> = {
  live: 'bg-tone-live-bg text-tone-live',
  idle: 'bg-tone-idle-bg text-tone-idle',
  paused: 'bg-tone-paused-bg text-tone-paused',
  dead: 'bg-tone-dead-bg text-tone-dead',
};

/** What a config's status means to a person, not what the column stores. */
export const CONFIG_STATUS_LABEL: Record<string, string> = {
  unassigned: 'Spare',
  active: 'Active',
  disabled: 'Disabled',
  revoked: 'Revoked',
};

export const NODE_STATUS_LABEL: Record<string, string> = {
  active: 'Online',
  degraded: 'Degraded',
  disabled: 'Removed',
};

/**
 * Every date and number in the app is formatted here. One module means `18 Jul 2026` looks
 * identical on every surface instead of drifting per component.
 */

const DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});
const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export const formatDate = (value: Date | string) => DATE.format(new Date(value));

/** The exact stamp, named zone included — used as the `title` behind a relative time. */
export const formatDateTime = (value: Date | string) => DATE_TIME.format(new Date(value));

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export function relativeTime(value: Date | string | number): string {
  const then = typeof value === 'number' ? value * 1000 : new Date(value).getTime();
  const seconds = Math.round((then - Date.now()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return RELATIVE.format(Math.round(seconds), 'second');
}

export const formatNumber = (value: number) => new Intl.NumberFormat('en-GB').format(value);

/** Writes the zero on purpose and gets the plural right: `0 configs`, `1 config`, `2 configs`. */
export function pluralise(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/**
 * Ids truncate in the MIDDLE — the head and tail are what make one recognisable, and cutting
 * the end of a WireGuard key leaves every key on screen looking identical.
 */
export function truncateId(value: string, head = 8, tail = 6) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Pinned rather than left to the runtime. The web apps render on the server in UTC and
 * hydrate in the browser in the user's local zone, so an unpinned formatter produces a
 * hydration mismatch and, for a late-evening timestamp, a different date on each side.
 */
export const DISPLAY_TIME_ZONE = 'Europe/London';

const dateFormats = {
  short: new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  }),
  long: new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  }),
} as const;

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: DISPLAY_TIME_ZONE,
});

export type DateFormat = keyof typeof dateFormats | 'longWithTime';

/**
 * Render an instant in the service's display time zone. Callers keep the machine-readable
 * value alongside it: `<time dateTime={iso}>{formatDate(iso, 'short')}</time>`.
 */
export function formatDate(value: Date | string, dateFormat: DateFormat = 'short'): string {
  const instant = typeof value === 'string' ? new Date(value) : value;

  if (dateFormat === 'longWithTime') {
    // GOV.UK style writes "12:30pm"; Intl separates the period with a space, so close it up.
    const time = timeFormat.format(instant).replace(/\s+/g, '').toLowerCase();

    return `${dateFormats.long.format(instant)} at ${time}`;
  }

  return dateFormats[dateFormat].format(instant);
}

import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';

/**
 * Pinned rather than left to the runtime. The web apps render on the server in UTC and
 * hydrate in the browser in the user's local zone, so an unpinned formatter produces a
 * hydration mismatch and, for a late-evening timestamp, a different date on each side.
 */
export const DISPLAY_TIME_ZONE = 'Europe/London';

export const DATE_FORMATS = {
  short: 'd MMM yyyy',
  long: 'd MMMM yyyy',
  longWithTime: "d MMMM yyyy 'at' h:mmaaa",
} as const;

export type DateFormat = keyof typeof DATE_FORMATS;

/**
 * Render an instant in the service's display time zone. Callers keep the machine-readable
 * value alongside it: `<time dateTime={iso}>{formatDate(iso, 'short')}</time>`.
 */
export function formatDate(value: Date | string, dateFormat: DateFormat = 'short'): string {
  const instant = typeof value === 'string' ? new Date(value) : value;

  return format(new TZDate(instant, DISPLAY_TIME_ZONE), DATE_FORMATS[dateFormat], { locale: enGB });
}

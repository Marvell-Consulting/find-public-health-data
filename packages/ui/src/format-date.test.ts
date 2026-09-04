import { describe, expect, it } from 'vitest';

import { formatDate } from './format-date';

describe('formatDate', () => {
  it.each([
    ['short', '5 Aug 2026'],
    ['long', '5 August 2026'],
    ['longWithTime', '5 August 2026 at 12:30pm'],
  ] as const)('renders the %s format', (dateFormat, expected) => {
    expect(formatDate('2026-08-05T11:30:00.000Z', dateFormat)).toBe(expected);
  });

  it('defaults to the short format', () => {
    expect(formatDate('2026-08-05T11:30:00.000Z')).toBe('5 Aug 2026');
  });

  it('accepts a Date as well as an ISO string', () => {
    expect(formatDate(new Date('2026-08-05T11:30:00.000Z'), 'long')).toBe('5 August 2026');
  });

  it('shifts a British Summer Time instant an hour ahead of UTC', () => {
    expect(formatDate('2026-08-05T11:30:00.000Z', 'longWithTime')).toBe('5 August 2026 at 12:30pm');
  });

  it('leaves a Greenwich Mean Time instant on UTC', () => {
    expect(formatDate('2026-01-05T11:30:00.000Z', 'longWithTime')).toBe(
      '5 January 2026 at 11:30am',
    );
  });

  // The reason the display zone is pinned: an unpinned formatter running on a UTC server
  // would call this the 4th, and a London browser the 5th.
  it('uses the London date, not the UTC date, for a late-evening instant', () => {
    expect(formatDate('2026-08-04T23:30:00.000Z', 'short')).toBe('5 Aug 2026');
  });
});

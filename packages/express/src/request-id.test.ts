import { describe, expect, it } from 'vitest';

import { readRequestIdHeader, requestId, uuidv7 } from './request-id.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('mints a version 7 uuid that a validator would accept', () => {
    expect(uuidv7()).toMatch(UUID_V7);
  });

  it('leads with the millisecond timestamp, so ids sort by time', () => {
    const at = new Date('2026-09-07T10:00:00.000Z').getTime();
    const earlier = uuidv7(at);
    const later = uuidv7(at + 1);

    expect(earlier.replace('-', '').slice(0, 12)).toBe(at.toString(16).padStart(12, '0'));
    expect(earlier < later).toBe(true);
  });

  it('is different every call', () => {
    expect(new Set(Array.from({ length: 100 }, () => uuidv7())).size).toBe(100);
  });
});

describe('readRequestIdHeader', () => {
  it('accepts a uuid, normalised to lower case', () => {
    expect(readRequestIdHeader('019924A1-2C40-7000-8000-000000000001')).toBe(
      '019924a1-2c40-7000-8000-000000000001',
    );
  });

  it.each([
    ['not a uuid', 'trace-me'],
    ['too long', '019924a1-2c40-7000-8000-000000000001-and-more'],
    ['repeated', ['019924a1-2c40-7000-8000-000000000001', '019924a1-2c40-7000-8000-000000000002']],
    ['absent', undefined],
  ])('rejects a header that is %s', (_label, value) => {
    expect(readRequestIdHeader(value)).toBeUndefined();
  });
});

describe('requestId', () => {
  it('reads the id the request logger set, and nothing else', () => {
    const request = { id: '019924a1-2c40-7000-8000-000000000001' };
    const counter = { id: 7 };
    const unlogged = {};

    expect(requestId(request as never)).toBe('019924a1-2c40-7000-8000-000000000001');
    expect(requestId(counter as never)).toBeUndefined();
    expect(requestId(unlogged as never)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { readRequestIdHeader, requestId } from './request-id.js';

describe('readRequestIdHeader', () => {
  it('accepts a version 7 uuid, normalised to lower case', () => {
    expect(readRequestIdHeader('019924A1-2C40-7000-8000-000000000001')).toBe(
      '019924a1-2c40-7000-8000-000000000001',
    );
  });

  it.each([
    ['not a uuid', 'trace-me'],
    ['a uuid of another version', '8f2c1a3e-5b7d-4c2e-9a1f-0d3e4b5c6a7b'],
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

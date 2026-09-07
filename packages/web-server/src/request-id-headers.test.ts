import { describe, expect, it } from 'vitest';

import { forwardedRequestIdHeaders } from './request-id-headers.js';

describe('forwardedRequestIdHeaders', () => {
  it('carries the id the request logger assigned', () => {
    const request = { id: '019924a1-2c40-7000-8000-000000000001' } as never;

    expect(forwardedRequestIdHeaders(request)).toEqual({
      'x-request-id': '019924a1-2c40-7000-8000-000000000001',
    });
  });

  it('sends nothing for a request no logger saw', () => {
    expect(forwardedRequestIdHeaders({} as never)).toEqual({});
  });
});

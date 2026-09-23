import { describe, expect, it } from 'vitest';

import { pageSearch } from './page-url.ts';

describe('pageSearch', () => {
  it('keeps the page query of a data request and drops its route list', () => {
    const url = new URL(
      'https://example.test/indicators/42.data?as=E06000001&_routes=routes%2Findicator',
    );

    expect(pageSearch(url)).toBe('?as=E06000001');
  });

  it('is empty when the route list was the only parameter', () => {
    expect(pageSearch(new URL('https://example.test/indicators/42.data?_routes=root'))).toBe('');
  });

  it('is empty for a request with no query', () => {
    expect(pageSearch(new URL('https://example.test/indicators/42'))).toBe('');
  });
});

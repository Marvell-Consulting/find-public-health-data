import { describe, expect, it } from 'vitest';

import { meta } from './route.tsx';

const list = { canCreate: true, indicators: [], page: 1, totalPages: 1 };
const underReview = { unassigned: [], assigned: [] };

function titleFor(loaderData: unknown) {
  return meta({ loaderData } as Parameters<typeof meta>[0]);
}

describe('the dashboard route', () => {
  it('titles the page for an IMRG manager as its heading, the indicators under review', () => {
    expect(titleFor({ underReview, list: null })).toEqual([
      { title: 'Indicators under review - Find public health data - GOV.UK' },
    ]);
  });

  it.each([
    ['a publisher', { underReview: null, list }],
    ['an IMRG manager who also publishes', { underReview, list }],
    ['a page whose loader failed', undefined],
  ])('titles the page for %s as Indicators', (_who, loaderData) => {
    expect(titleFor(loaderData)).toEqual([
      { title: 'Indicators - Find public health data - GOV.UK' },
    ]);
  });
});

// @vitest-environment jsdom

import type { LoaderFunctionArgs } from 'react-router';
import { expect, it, vi } from 'vitest';
import { loadTopic } from './loader.ts';
import { loader } from './table-csv-route.ts';

vi.mock('./loader.ts', () => ({ loadTopic: vi.fn() }));

it.each([
  ['no-polarity', 'No comparison available'],
  ['higher-is-better', 'Better than England'],
] as const)('exports the visible judgement for %s indicators', async (polarity, label) => {
  const observation = (value: number) => ({
    fromDate: '2024-01-01',
    toDate: '2024-12-31',
    value,
    count: null,
    denominator: null,
    dimensions: [],
    notes: [],
    lowerCi95: value - 1,
    upperCi95: value + 1,
    lowerCi998: null,
    upperCi998: null,
  });
  vi.mocked(loadTopic).mockResolvedValue({
    topic: { slug: 'example', title: 'Example' },
    content: {
      data: {
        selected: [
          {
            detail: {
              shortId: 1,
              slug: 'example',
              name: 'Example indicator',
              unit: '%',
              yearType: null,
              polarity,
              comparatorMethod: 'Confidence intervals overlapping reference value',
              topics: [],
            },
            areaData: [
              { areaCode: 'E92000001', areaName: 'England', observations: [observation(10)] },
              { areaCode: 'E12000001', areaName: 'North East', observations: [observation(20)] },
            ],
          },
        ],
        benchmarkGeography: { regionByCode: {}, levelByCode: {} },
      },
    },
  } as unknown as Awaited<ReturnType<typeof loadTopic>>);
  const response = await loader({
    request: new Request('http://local/topics/example/table.csv?tab-topic=areas'),
  } as LoaderFunctionArgs);
  const lines = (await response.text()).trim().split(/\r?\n/);
  expect(lines).toHaveLength(2);
  expect(lines[0]).toContain('North East comparison');
  expect(lines[1]).toContain(label);
  expect(lines[1]).toContain('Example indicator,%,2024,10,2024,20,2024,');
});

import type { LoaderFunctionArgs } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadIndicator } from './loader.ts';
import { observation, selected } from './view.testing.ts';
import { loadIndicatorViewCsv } from './view-csv.ts';

vi.mock('./loader.ts', () => ({ loadIndicator: vi.fn() }));
const primary = selected();
const compared = selected(241);
const areas = [
  { areaCode: 'E06000052', areaName: 'Cornwall', observations: [observation(30)] },
  { areaCode: 'E06000001', areaName: 'Hartlepool', observations: [observation(10)] },
];
beforeEach(() =>
  vi.mocked(loadIndicator).mockResolvedValue({
    selected: [primary, compared],
    compareAreasData: areas,
    comparedAreasData: areas,
    compareAreaGroup: 'Local authorities',
  } as Awaited<ReturnType<typeof loadIndicator>>),
);
function args(query: string): LoaderFunctionArgs {
  return {
    request: new Request(`http://localhost/indicator/indicator-108/table.csv?${query}`),
  } as LoaderFunctionArgs;
}

describe('indicator view CSV', () => {
  it('exports the area table in the selected sort and colour order', async () => {
    const response = await loadIndicatorViewCsv(
      args('tab-indicator=areas&areaSort=alphabetical&areaColour=quartiles'),
    );
    const lines = (await response.text()).trim().split('\n');
    expect(lines[0]).toBe(
      'Area,Value (%),Quartile,95% lower confidence interval,95% upper confidence interval',
    );
    expect(lines[2]).toBe('Cornwall,30,Quartile 3,29,31');
    expect(lines[3]).toBe('Hartlepool,10,Quartile 1 (lowest),9,11');
  });
  it('exports the indicator pair with England, highlighted areas and the group range', async () => {
    const response = await loadIndicatorViewCsv(args('tab-indicator=compare&highlight=E06000052'));
    const lines = (await response.text()).trim().split('\n');
    expect(lines[0]).toBe('Area,Indicator 108 (%) (2024),Indicator 241 (%) (2024)');
    expect(lines).toContain('Cornwall,30,30');
    expect(lines).not.toContain('Hartlepool,10,10');
    expect(lines.at(-1)).toContain('Local authorities (2 areas)');
  });
  it('exports the displayed inequality area and matching England benchmark after stale filters', async () => {
    const response = await loadIndicatorViewCsv(
      args(
        'tab-indicator=inequalities&ig-108=E92000001&ic-108=unpublished&ip-108=missing&ci-108=95',
      ),
    );
    const lines = (await response.text()).trim().split('\n');
    expect(lines[0]).toBe('Segment,Count,Value (%),Compared with England');
    expect(lines[1]).toBe('England,2000,20,Benchmark');
    expect(lines[2]).toBe('Most deprived,3200,32,Better than England');
  });
});

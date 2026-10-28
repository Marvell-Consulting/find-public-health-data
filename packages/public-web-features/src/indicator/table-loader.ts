import {
  indicatorTableDataSchema,
  MAX_AREA_CODES_PER_REQUEST,
  MAX_TABLE_INDICATORS_PER_REQUEST,
} from '@fphd/public-api-features/contract';
import type { ApiClient } from '@fphd/web-server/api-client';
import { loadInBatches } from './batches.ts';

export async function loadIndicatorTableEntries(
  api: ApiClient,
  shortIds: number[],
  areaCodes: string[],
) {
  const codes = areaCodes.includes('E92000001')
    ? ['E92000001', ...areaCodes.filter((code) => code !== 'E92000001')]
    : areaCodes;
  const indicatorBatches = Array.from(
    { length: Math.ceil(shortIds.length / MAX_TABLE_INDICATORS_PER_REQUEST) },
    (_, index) =>
      shortIds.slice(
        index * MAX_TABLE_INDICATORS_PER_REQUEST,
        (index + 1) * MAX_TABLE_INDICATORS_PER_REQUEST,
      ),
  );
  const areaBatches = Array.from(
    { length: Math.ceil(codes.length / MAX_AREA_CODES_PER_REQUEST) },
    (_, index) =>
      codes.slice(index * MAX_AREA_CODES_PER_REQUEST, (index + 1) * MAX_AREA_CODES_PER_REQUEST),
  );
  return (
    await loadInBatches(indicatorBatches, async (ids) => {
      const parts = (
        await loadInBatches(areaBatches, (areas) => {
          const params = new URLSearchParams();
          for (const id of ids) params.append('indicator', String(id));
          for (const code of areas) params.append('areaCode', code);
          return api.get(`/api/indicator-data?${params}`, indicatorTableDataSchema);
        })
      ).flat();
      return ids.flatMap((id) => {
        const entries = parts.filter(({ detail }) => detail.shortId === id);
        const detail = entries[0]?.detail;
        if (!detail) return [];
        const byArea = new Map(
          entries.flatMap(({ areaData }) => areaData).map((area) => [area.areaCode, area]),
        );
        return [
          {
            detail,
            areaData: areaCodes.flatMap((code) => {
              const area = byArea.get(code);
              return area ? [area] : [];
            }),
            regionData: [],
            ranges: {},
          },
        ];
      });
    })
  ).flat();
}

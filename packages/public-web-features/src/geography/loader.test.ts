import type { ApiClient } from '@fphd/web-server/api-client';
import { expect, it, vi } from 'vitest';
import { findGeographyGroups, loadGeographyOptions } from './loader.ts';

it('filters the complete local-authority catalogue by tier before limiting a picker preview', async () => {
  const areas = [
    ...Array.from({ length: 110 }, (_, i) => ({
      code: `E07${String(i).padStart(6, '0')}`,
      name: `District ${i}`,
    })),
    ...Array.from({ length: 105 }, (_, i) => ({
      code: `E06${String(i).padStart(6, '0')}`,
      name: `Unitary ${i}`,
    })),
  ];
  const get = vi.fn().mockResolvedValue([{ displayGroup: 'Local authorities', areas }]);
  const result = await findGeographyGroups({ get } as unknown as ApiClient, {
    level: 'Upper-tier local authorities',
    indicator: 'diabetes',
    publicOnly: true,
  });
  expect(result[0]?.areas).toHaveLength(101);
  expect(result[0]?.areas.every((area) => area.code.startsWith('E06'))).toBe(true);
  expect(get).toHaveBeenCalledWith(
    '/api/indicators/diabetes/areas?displayGroup=Local+authorities',
    expect.anything(),
  );
});

it('uses public tier labels in the initial server-rendered picker without loading GP catalogues', async () => {
  const get = vi.fn().mockResolvedValue([
    {
      displayGroup: 'Local authorities',
      areas: [
        { code: 'E10000001', name: 'County' },
        { code: 'E07000001', name: 'District' },
      ],
    },
  ]);
  const result = await loadGeographyOptions(
    { get } as unknown as ApiClient,
    new URLSearchParams(),
    ['Upper-tier local authorities', 'Lower-tier local authorities'],
    { publicOnly: true },
  );
  expect(result.previews).toEqual([
    { name: 'Upper-tier local authorities', areas: [{ code: 'E10000001', name: 'County' }] },
    { name: 'Lower-tier local authorities', areas: [{ code: 'E07000001', name: 'District' }] },
  ]);
  expect(get.mock.calls.every(([path]) => !path.includes('GP'))).toBe(true);
});

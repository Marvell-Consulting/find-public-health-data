import { expect, it } from 'vitest';
import {
  areasInGeographyGroup,
  normalizePublicLevels,
  publicGeographyLevels,
  sourceGeographyGroup,
} from './groups.ts';

it('separates counties and districts while including single-tier authorities in both tiers', () => {
  const areas = ['E06000001', 'E07000001', 'E08000001', 'E09000001', 'E10000001'].map((code) => ({
    code,
  }));
  expect(areasInGeographyGroup(areas, 'Upper-tier local authorities').map((a) => a.code)).toEqual([
    'E06000001',
    'E08000001',
    'E09000001',
    'E10000001',
  ]);
  expect(areasInGeographyGroup(areas, 'Lower-tier local authorities').map((a) => a.code)).toEqual([
    'E06000001',
    'E07000001',
    'E08000001',
    'E09000001',
  ]);
});
it('keeps old whole-authority links meaningful and maps labels back to the API catalogue', () => {
  expect(normalizePublicLevels(['Local authorities', 'NHS regions'])).toEqual([
    'Upper-tier local authorities',
    'Lower-tier local authorities',
    'NHS regions',
  ]);
  expect(sourceGeographyGroup('Upper-tier local authorities')).toBe('Local authorities');
  expect(
    publicGeographyLevels(['GP practices', 'Integrated care boards', 'Local authorities']),
  ).toEqual([
    'Integrated care boards (ICBs)',
    'Upper-tier local authorities',
    'Lower-tier local authorities',
  ]);
});

import type { DataTableReferences } from './data-table-rows.ts';

export const ENGLAND = '00000000-0000-7000-8000-00000000a001';
export const LEEDS = '00000000-0000-7000-8000-00000000a002';
export const FEMALE = '00000000-0000-7000-8000-00000000d001';
export const UNDER_75 = '00000000-0000-7000-8000-00000000d002';
export const ALL_AGES = '00000000-0000-7000-8000-00000000d003';
export const WHITE = '00000000-0000-7000-8000-00000000d004';
export const SMALL_COUNT = '00000000-0000-7000-8000-00000000e001';

/** A little reference data, named as the tidied database names are. */
export const references: DataTableReferences = {
  areaIds: new Map([
    ['E92000001', ENGLAND],
    ['E08000035', LEEDS],
  ]),
  sexIds: new Map([['Female', FEMALE]]),
  ageIds: new Map([
    ['<75 yrs', UNDER_75],
    ['All ages', ALL_AGES],
  ]),
  categoryIds: new Map([['Ethnic groups', new Map([['White', WHITE]])]]),
  noteTypeIds: new Map([['Value suppressed for disclosure control', SMALL_COUNT]]),
};

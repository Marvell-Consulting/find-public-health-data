import { describe, expect, it } from 'vitest';

import {
  ageValueIdForObservation,
  classificationScheme,
  dimensionClass,
  granularity,
  normalizeCategoryTypeName,
  sexValueIdForObservation,
} from './dimensions.ts';
import { AGE_DIMENSION_TYPE_ID, SEX_DIMENSION_TYPE_ID } from './ids.ts';

describe('dimensionClass', () => {
  it('returns core for Sex and Age by design (those are hard-coded, not run through this)', () => {
    expect(SEX_DIMENSION_TYPE_ID).toBe(1);
    expect(AGE_DIMENSION_TYPE_ID).toBe(2);
  });

  it('returns inequality for deprivation types', () => {
    expect(dimensionClass('IMD2010 deprivation deciles')).toBe('inequality');
    expect(dimensionClass('IDACI score')).toBe('inequality');
    expect(dimensionClass('deprivation quintiles in England')).toBe('inequality');
  });

  it('returns inequality for ethnicity types', () => {
    expect(dimensionClass('Ethnic groups')).toBe('inequality');
    expect(dimensionClass('Ethnicity broad groups')).toBe('inequality');
  });

  it('returns inequality for sexuality types (Sexual... prefix)', () => {
    expect(dimensionClass('Sexuality')).toBe('inequality');
    expect(dimensionClass('Sexual orientation')).toBe('inequality');
  });

  it('returns inequality for religion and disability', () => {
    expect(dimensionClass('Religion groups')).toBe('inequality');
    expect(dimensionClass('Disabled persons')).toBe('inequality');
  });

  it('returns clinical for clinical types', () => {
    expect(dimensionClass('Condition groups')).toBe('clinical');
    expect(dimensionClass('Exposure groups')).toBe('clinical');
    expect(dimensionClass('HIV Infection groups')).toBe('clinical');
    expect(dimensionClass('Long term conditions')).toBe('clinical');
    expect(dimensionClass('Severe mental illness')).toBe('clinical');
    expect(dimensionClass('Intervention setting')).toBe('clinical');
    expect(dimensionClass('High intensity therapies')).toBe('clinical');
    expect(dimensionClass('Phase type grouping')).toBe('clinical');
  });

  it('returns demographic for everything else', () => {
    expect(dimensionClass('Age of mother')).toBe('demographic');
    expect(dimensionClass('Housing tenure')).toBe('demographic');
    expect(dimensionClass('School year')).toBe('demographic');
    expect(dimensionClass('Working status')).toBe('demographic');
  });
});

describe('classificationScheme', () => {
  it('assigns IMD year schemes by name pattern', () => {
    expect(
      classificationScheme({
        CategoryTypeID: 999,
        Name: 'LSOA11 deprivation deciles in England (IMD2019)',
      }),
    ).toBe('IMD2019');
    expect(
      classificationScheme({
        CategoryTypeID: 999,
        Name: 'County & UA deprivation deciles in England (IMD2010)',
      }),
    ).toBe('IMD2010');
    expect(
      classificationScheme({
        CategoryTypeID: 999,
        Name: 'LSOA11 deprivation deciles in England (IMD2025)',
      }),
    ).toBe('IMD2025');
  });

  it('assigns IDACI scheme', () => {
    expect(
      classificationScheme({
        CategoryTypeID: 91,
        Name: 'LSOA11 deprivation deciles within area (IDACI)',
      }),
    ).toBe('IDACI');
  });

  it('assigns IMD-trend scheme', () => {
    expect(
      classificationScheme({
        CategoryTypeID: 71,
        Name: 'LSOA11 deprivation deciles within area (IMD  trend)',
      }),
    ).toBe('IMD-trend');
  });

  it('assigns ethnicity schemes by CategoryTypeID', () => {
    expect(classificationScheme({ CategoryTypeID: 17, Name: 'Ethnic groups [17]' })).toBe(
      'ONS-17cat',
    );
    expect(classificationScheme({ CategoryTypeID: 18, Name: 'Ethnic groups [18]' })).toBe(
      'ONS-18cat',
    );
    expect(classificationScheme({ CategoryTypeID: 152, Name: 'Ethnic groups [152]' })).toBe(
      'ONS-19cat',
    );
    expect(classificationScheme({ CategoryTypeID: 15, Name: 'Ethnic groups [15]' })).toBe('binary');
  });

  it('assigns name-pattern schemes', () => {
    expect(classificationScheme({ CategoryTypeID: 999, Name: 'Age of mother groups' })).toBe(
      'age-of-mother',
    );
    expect(classificationScheme({ CategoryTypeID: 999, Name: 'Housing tenure' })).toBe(
      'housing-tenure',
    );
    expect(classificationScheme({ CategoryTypeID: 999, Name: 'Rurality classification' })).toBe(
      'rurality',
    );
  });

  it('falls back to the category type name when no pattern matches', () => {
    expect(classificationScheme({ CategoryTypeID: 9999, Name: 'Some custom dimension' })).toBe(
      'Some custom dimension',
    );
  });
});

describe('granularity', () => {
  it('returns deciles for names containing "decile"', () => {
    expect(granularity('IMD2010 deprivation deciles')).toBe('deciles');
    expect(granularity('LSOA11 deprivation deciles within area')).toBe('deciles');
  });

  it('returns quintiles for names containing "quintile"', () => {
    expect(granularity('deprivation quintiles in England')).toBe('quintiles');
  });

  it('returns null for everything else', () => {
    expect(granularity('Ethnicity')).toBeNull();
    expect(granularity('Age of mother')).toBeNull();
  });
});

describe('ageValueIdForObservation', () => {
  it('returns null for AgeID -1 (unknown)', () => {
    expect(ageValueIdForObservation(-1, null)).toBeNull();
  });

  it('returns null for AgeID 1 (All ages aggregate)', () => {
    expect(ageValueIdForObservation(1, null)).toBeNull();
  });

  it('remaps AgeID 325 to 303', () => {
    const id325 = ageValueIdForObservation(325, null);
    const id303 = ageValueIdForObservation(303, null);
    expect(id325).toBe(id303);
    expect(id325).not.toBeNull();
  });

  it('returns compound id for AgeID 209 M and F', () => {
    const male = ageValueIdForObservation(209, 'M');
    const female = ageValueIdForObservation(209, 'F');
    expect(male).not.toBeNull();
    expect(female).not.toBeNull();
    expect(male).not.toBe(female);
  });

  it('returns compound id for AgeID 212', () => {
    const male = ageValueIdForObservation(212, 'M');
    const female = ageValueIdForObservation(212, 'F');
    expect(male).not.toBeNull();
    expect(female).not.toBeNull();
    expect(male).not.toBe(female);
  });

  it('returns compound id for AgeID 274 F; M returns same id as AgeID 209 M', () => {
    const female = ageValueIdForObservation(274, 'F');
    const male = ageValueIdForObservation(274, 'M');
    const m209 = ageValueIdForObservation(209, 'M');
    expect(female).not.toBeNull();
    expect(male).toBe(m209);
  });

  it('returns null for compound AgeID when sex is null', () => {
    expect(ageValueIdForObservation(209, null)).toBeNull();
  });

  it('returns a regular age value id for ordinary AgeIDs', () => {
    const id = ageValueIdForObservation(28, null);
    expect(id).not.toBeNull();
    expect(id).toBeGreaterThan(0);
  });
});

describe('sexValueIdForObservation', () => {
  it('returns null for SexID 4 (total/unspecified)', () => {
    expect(sexValueIdForObservation(4)).toBeNull();
  });

  it('returns null for SexID -1 (not applicable)', () => {
    expect(sexValueIdForObservation(-1)).toBeNull();
  });

  it('returns distinct ids for Male (1) and Female (2)', () => {
    const male = sexValueIdForObservation(1);
    const female = sexValueIdForObservation(2);
    expect(male).not.toBeNull();
    expect(female).not.toBeNull();
    expect(male).not.toBe(female);
  });
});

describe('normalizeCategoryTypeName', () => {
  it('strips trailing spaces to match SQL Server trailing-space-ignoring collation', () => {
    expect(normalizeCategoryTypeName('Ethnic groups ')).toBe('ethnic groups');
    expect(normalizeCategoryTypeName('Ethnic groups')).toBe('ethnic groups');
  });

  it('lowercases to match SQL Server case-insensitive collation', () => {
    expect(normalizeCategoryTypeName('IMD2019')).toBe('imd2019');
    expect(normalizeCategoryTypeName('imd2019')).toBe('imd2019');
  });

  it('preserves leading spaces (SQL Server only ignores trailing)', () => {
    expect(normalizeCategoryTypeName(' Ethnic groups')).toBe(' ethnic groups');
  });

  it('makes CT152 "Ethnic groups " and CT17 "Ethnic groups" collide', () => {
    const ct17 = normalizeCategoryTypeName('Ethnic groups');
    const ct152 = normalizeCategoryTypeName('Ethnic groups ');
    expect(ct17).toBe(ct152);
  });
});

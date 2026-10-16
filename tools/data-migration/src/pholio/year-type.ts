import type { PeriodType, YearType } from '@fphd/utils/period-type';

export interface YearTypeEntry {
  period_type: PeriodType;
  year_type: YearType;
  year_end_day: number | null;
  year_end_month: number | null;
}

export const YEAR_TYPES: Readonly<Record<string, YearTypeEntry>> = {
  Calendar: {
    period_type: 'years',
    year_type: 'calendar',
    year_end_day: null,
    year_end_month: null,
  },
  Financial: {
    period_type: 'years',
    year_type: 'financial',
    year_end_day: null,
    year_end_month: null,
  },
  Academic: {
    period_type: 'years',
    year_type: 'academic',
    year_end_day: null,
    year_end_month: null,
  },
  'August-July': {
    period_type: 'years',
    year_type: 'specified-end-date',
    year_end_day: 31,
    year_end_month: 7,
  },
  'July-June': {
    period_type: 'years',
    year_type: 'specified-end-date',
    year_end_day: 30,
    year_end_month: 6,
  },
  'October-September': {
    period_type: 'years',
    year_type: 'specified-end-date',
    year_end_day: 30,
    year_end_month: 9,
  },
  'March-February': {
    period_type: 'years',
    year_type: 'specified-end-date',
    year_end_day: 28,
    year_end_month: 2,
  },
  'November-November': {
    period_type: 'years',
    year_type: 'specified-end-date',
    year_end_day: 15,
    year_end_month: 11,
  },
  'September-January': {
    period_type: 'years',
    year_type: 'specified-end-date',
    year_end_day: 31,
    year_end_month: 1,
  },
  'September-February': {
    period_type: 'years',
    year_type: 'specified-end-date',
    year_end_day: 28,
    year_end_month: 2,
  },
  'Calendar rolling year - monthly': {
    period_type: 'years',
    year_type: 'rolling',
    year_end_day: null,
    year_end_month: null,
  },
  'Calendar rolling year - quarterly': {
    period_type: 'years',
    year_type: 'rolling',
    year_end_day: null,
    year_end_month: null,
  },
  'Financial rolling year - monthly': {
    period_type: 'years',
    year_type: 'rolling',
    year_end_day: null,
    year_end_month: null,
  },
  'Financial rolling year - quarterly': {
    period_type: 'years',
    year_type: 'rolling',
    year_end_day: null,
    year_end_month: null,
  },
  'Financial single year cumulative quarters': {
    period_type: 'quarters',
    year_type: 'financial',
    year_end_day: null,
    year_end_month: null,
  },
  'Financial multi year cumulative quarters': {
    period_type: 'quarters',
    year_type: 'financial',
    year_end_day: null,
    year_end_month: null,
  },
  'Financial year end point': {
    period_type: 'years',
    year_type: 'specified-end-date',
    year_end_day: 31,
    year_end_month: 3,
  },
};

export function yearTypeValues(name: string): YearTypeEntry {
  const entry = YEAR_TYPES[name];
  if (entry === undefined)
    throw new Error(`No year type value for the Fingertips year type ${JSON.stringify(name)}`);
  return entry;
}

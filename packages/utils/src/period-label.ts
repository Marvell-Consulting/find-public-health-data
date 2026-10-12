import type { PublicYearType } from './period-type.ts';

/** A period as observations store it: ISO dates, both inclusive. */
export interface Period {
  fromDate: string;
  toDate: string;
}

function daysBetween(fromDate: string, toDate: string): number {
  return (Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000;
}

export function periodLabel(
  { fromDate, toDate }: Period,
  yearType?: PublicYearType | null,
): string {
  const fromYear = fromDate.slice(0, 4);
  const toYear = toDate.slice(0, 4);
  if (fromYear === toYear) {
    return fromYear;
  }
  // A financial year spans two calendar years but is one period: 2009/10, not
  // "2009 to 2010" — that form is reserved for genuine multi-year ranges.
  const days = daysBetween(fromDate, toDate);
  if (yearType?.value === 'financial' && days <= 400) {
    return `${fromYear}/${toYear.slice(2)}`;
  }
  return `${fromYear} to ${toYear}`;
}

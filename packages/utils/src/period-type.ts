/** How long each of an indicator's periods is. Each id is its `period_type` row's. */
export const PERIOD_TYPES = {
  years: { id: '01a0d88c-310a-7c54-b512-a99ca789cc12', name: 'Years' },
  quarters: { id: '01a0d88c-310a-7c9d-b589-353d97eedb54', name: 'Quarters' },
  months: { id: '01a0d88c-310a-7ca1-9ba4-031b00f46799', name: 'Months' },
} as const;

/** The year an indicator's years or quarters belong to. Each id is its `year_type` row's. */
export const YEAR_TYPES = {
  calendar: { id: '01a0d88c-310a-7ca5-8494-19e32c307628', name: 'Calendar' },
  financial: { id: '01a0d88c-310a-7ca8-9a3b-40fc6f585b8a', name: 'Financial' },
  academic: { id: '01a0d88c-310a-7cab-8847-543e49e4c685', name: 'Academic' },
  rolling: { id: '01a0d88c-310a-7cae-ae91-2c6e6e6b707a', name: 'Rolling' },
  specifiedEndDate: { id: '01a0d88c-310a-7cb1-af6e-3712b2958e12', name: 'Ending a specified date' },
} as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Whether a day falls in a month of some year; 29 February does, in a leap year. */
export function isDayOfMonth(day: number, month: number): boolean {
  return (
    Number.isInteger(day) &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    new Date(Date.UTC(2000, month - 1, day)).getUTCDate() === day
  );
}

export interface YearEnd {
  day: number;
  month: number;
}

function monthName(month: number): string {
  const name = MONTH_NAMES[month - 1];
  if (name === undefined) throw new Error(`Not a month: ${month}`);
  return name;
}

/**
 * A year type as the public reads it: its name, or for a specified end date the months the year
 * runs between ("August to July") when it ends on a month's last day, and the date otherwise.
 */
export function yearTypeLabel(
  yearType: { id: string; name: string } | null,
  yearEnd: YearEnd | null,
): string | null {
  if (yearType === null) return null;
  if (yearType.id !== YEAR_TYPES.specifiedEndDate.id || yearEnd === null) return yearType.name;

  const { day, month } = yearEnd;
  // 28 February ends the month in three years out of four, and is taken to mean its end.
  const endsMonth = !isDayOfMonth(day + 1, month) || (month === 2 && day === 28);

  return endsMonth
    ? `${monthName((month % 12) + 1)} to ${monthName(month)}`
    : `Year ending ${day} ${monthName(month)}`;
}

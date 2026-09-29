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

type YearType = (typeof YEAR_TYPES)[keyof typeof YEAR_TYPES];

/** The last day of each named year type's year; a year ending on one is that year type. */
const NAMED_YEAR_ENDS: readonly (YearEnd & { yearType: YearType })[] = [
  { day: 31, month: 12, yearType: YEAR_TYPES.calendar },
  { day: 31, month: 3, yearType: YEAR_TYPES.financial },
  // The UK school year runs from 1 September to 31 August.
  { day: 31, month: 8, yearType: YEAR_TYPES.academic },
];

function sameYearEnd(a: YearEnd, b: YearEnd): boolean {
  return a.day === b.day && a.month === b.month;
}

/** The months a year ending on a month's last day runs between, or else the date it ends. */
function yearEndLabel({ day, month }: YearEnd): string {
  // 28 February ends the month in three years out of four, and is taken to mean its end.
  const endsMonth = !isDayOfMonth(day + 1, month) || (month === 2 && day === 28);

  return endsMonth
    ? `${monthName((month % 12) + 1)} to ${monthName(month)}`
    : `Year ending ${day} ${monthName(month)}`;
}

/** A year type as the public reads it; the id is the named year type's where one is folded in. */
export interface PublicYearType {
  id: string;
  label: string;
}

/**
 * A version's year type as the public reads it. A year ending on a specified date is the named
 * year type ending on that date if there is one, and is otherwise named by the months it runs
 * between ("August to July") when it ends on a month's last day, and by its date otherwise.
 */
export function publicYearType(yearTypeId: string, yearEnd: YearEnd | null): PublicYearType {
  if (yearTypeId === YEAR_TYPES.specifiedEndDate.id && yearEnd !== null) {
    const named = NAMED_YEAR_ENDS.find((end) => sameYearEnd(end, yearEnd));
    return named
      ? { id: named.yearType.id, label: named.yearType.name }
      : { id: yearTypeId, label: yearEndLabel(yearEnd) };
  }
  const yearType = Object.values(YEAR_TYPES).find(({ id }) => id === yearTypeId);
  if (yearType === undefined) throw new Error(`Not a year type: ${yearTypeId}`);
  return { id: yearType.id, label: yearType.name };
}

/** A stored year type and year end, as a search matches versions by. */
export interface YearTypeValues {
  yearTypeId: string;
  yearEnd: YearEnd | null;
}

/** Every year type and year end a version can hold, by the label the public reads it by. */
function yearTypeValuesByLabel(): Map<string, YearTypeValues[]> {
  const named = Object.values(YEAR_TYPES)
    .filter(({ id }) => id !== YEAR_TYPES.specifiedEndDate.id)
    .map(({ id }) => ({ yearTypeId: id, yearEnd: null }));
  // Every day of a leap year, so 29 February is among them.
  const dates = Array.from({ length: 366 }, (_, index) => {
    const date = new Date(Date.UTC(2000, 0, 1 + index));
    return {
      yearTypeId: YEAR_TYPES.specifiedEndDate.id,
      yearEnd: { day: date.getUTCDate(), month: date.getUTCMonth() + 1 },
    };
  });
  const byLabel = new Map<string, YearTypeValues[]>();
  for (const values of [...named, ...dates]) {
    const { label } = publicYearType(values.yearTypeId, values.yearEnd);
    byLabel.set(label, [...(byLabel.get(label) ?? []), values]);
  }
  return byLabel;
}

const YEAR_TYPE_VALUES_BY_LABEL = yearTypeValuesByLabel();

/**
 * The year types and year ends the public reads by a label, for a search by it. The months a
 * named year type runs between ("April to March") are read as that year type.
 */
export function yearTypeValuesLabelled(label: string): YearTypeValues[] {
  const named = NAMED_YEAR_ENDS.find((end) => yearEndLabel(end) === label);
  return YEAR_TYPE_VALUES_BY_LABEL.get(named?.yearType.name ?? label) ?? [];
}

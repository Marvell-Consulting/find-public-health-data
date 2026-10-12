import { monthName, type PublicYearType } from './period-type.ts';

/** A period as observations store it: ISO dates, both inclusive. */
export interface Period {
  fromDate: string;
  toDate: string;
}

interface Day {
  year: number;
  month: number;
  day: number;
}

function dayOf(date: string): Day {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = date.split('-').map(Number);
  return { year, month, day };
}

function nextDay({ year, month, day }: Day): Day {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/** How many years the period runs, when it ends the day before an anniversary of its start. */
function wholeYears(from: Day, to: Day): number {
  const after = nextDay(to);
  return after.month === from.month && after.day === from.day ? after.year - from.year : 0;
}

function dayLabel({ year, month, day }: Day): string {
  return `${day} ${monthName(month)} ${year}`;
}

/** A year from 1 January is a calendar year; any other spans two and is written 2022/23. */
function yearLabel(start: Day): string {
  return start.month === 1 && start.day === 1
    ? String(start.year)
    : `${start.year}/${String(start.year + 1).slice(-2)}`;
}

function monthsLabel(from: Day, to: Day): string {
  if (from.year !== to.year) {
    return `${monthName(from.month)} ${from.year} to ${monthName(to.month)} ${to.year}`;
  }
  return from.month === to.month
    ? `${monthName(to.month)} ${to.year}`
    : `${monthName(from.month)} to ${monthName(to.month)} ${to.year}`;
}

/**
 * A period's label, from its dates: a day, a month or run of months ("January to March 2023"),
 * a year (2023, or 2022/23 when it starts on another date) or run of years ("2020/21 to
 * 2022/23"), and otherwise its two dates. Rolling years start every month, so one that spans two
 * calendar years is named by its months rather than all sharing one label.
 */
export function periodLabel(
  { fromDate, toDate }: Period,
  yearType?: PublicYearType | null,
): string {
  const from = dayOf(fromDate);
  const to = dayOf(toDate);

  if (fromDate === toDate) return dayLabel(from);

  const years = wholeYears(from, to);
  const calendarYears = from.month === 1 && from.day === 1;
  if (years > 0 && (calendarYears || yearType?.value !== 'rolling')) {
    const last = yearLabel({ ...from, year: from.year + years - 1 });
    return years === 1 ? last : `${yearLabel(from)} to ${last}`;
  }

  if (from.day === 1 && nextDay(to).day === 1) return monthsLabel(from, to);

  return `${dayLabel(from)} to ${dayLabel(to)}`;
}

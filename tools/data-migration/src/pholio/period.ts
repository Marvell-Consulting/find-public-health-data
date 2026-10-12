function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dateParts(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Last calendar day of a given month (handles leap years). */
export function endOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(year: number, month: number, day: number, days: number): string {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

function yearTypeFromMonth(yearTypeId: number): number {
  switch (yearTypeId) {
    case 2:
    case 4:
    case 7:
    case 10:
      return 4;
    case 3:
    case 17:
    case 18:
      return 9;
    case 8:
      return 8;
    case 9:
      return 3;
    case 11:
      return 10;
    case 13:
      return 7;
    case 14:
      return 11;
    case 1:
    case 5:
    case 6:
    case 12:
    case 16:
      return 1;
    default:
      throw new Error(`Unsupported source year type ${yearTypeId}`);
  }
}

/**
 * Start of an annual source period.
 */
export function yearTypeOnlyFromDate(year: number, yearTypeId: number): string {
  return dateParts(year, yearTypeFromMonth(yearTypeId), 1);
}

/**
 * End of an annual source period.
 */
export function yearTypeOnlyToDate(year: number, yearRange: number, yearTypeId: number): string {
  if (yearRange > 0) {
    switch (yearTypeId) {
      case 17:
        return dateParts(year + 1, 1, 31);
      case 18:
        return endOfMonth(year + 1, 2);
      default: {
        const fromMonth = yearTypeFromMonth(yearTypeId);
        return addDays(year + yearRange, fromMonth, 1, -1);
      }
    }
  }
  return yearTypeOnlyToDate(year, 1, yearTypeId);
}

/**
 * Converts source periods without collapsing cumulative or rolling quarters.
 */
export function computeDates(
  year: number,
  month: number,
  quarter: number,
  yearRange: number,
  yearTypeId: number,
): { fromDate: string; toDate: string } {
  const firstMonth = yearTypeFromMonth(yearTypeId);
  if (yearTypeId === 16) {
    const date = dateParts(year, 3, 31);
    return { fromDate: date, toDate: date };
  }
  if ((yearTypeId === 7 || yearTypeId === 10) && quarter > 0) {
    const end = new Date(Date.UTC(year, 3 + quarter * 3, 0));
    return {
      fromDate: dateParts(year, 4, 1),
      toDate: dateParts(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()),
    };
  }
  if (month !== -1) {
    if (month < 1 || month > 12) throw new Error(`Invalid source month ${month}`);
    if (yearTypeId === 12)
      throw new Error('Financial rolling monthly periods require a verified source mapping');
    const rolling = yearTypeId === 6;
    return {
      fromDate: dateParts(year, month, 1),
      toDate: endOfMonth(year + (rolling ? 1 : 0), month - (rolling ? 1 : 0)),
    };
  }
  if (quarter >= 1 && quarter <= 4) {
    const fiscal = yearTypeId === 2 || yearTypeId === 4;
    const start = new Date(Date.UTC(year, (fiscal ? firstMonth - 1 : 0) + (quarter - 1) * 3, 1));
    const months = yearTypeId === 4 || yearTypeId === 5 ? 12 : 3;
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 0));
    return {
      fromDate: dateParts(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
      toDate: dateParts(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()),
    };
  }
  if (quarter !== -1) throw new Error(`Unsupported quarter ${quarter} for year type ${yearTypeId}`);
  const fromDate = dateParts(year, firstMonth, 1);
  const toDate = yearTypeOnlyToDate(year, yearRange, yearTypeId);
  return { fromDate, toDate };
}

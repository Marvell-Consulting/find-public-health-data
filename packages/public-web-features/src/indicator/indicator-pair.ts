import { areaComparisonRows } from './area-comparison.ts';
import { formatCalculatedValue, withUnit } from './data.ts';
import type { SelectedIndicator } from './loader.ts';

export function indicatorPair(selected: [SelectedIndicator, SelectedIndicator]) {
  const data = selected.map((indicator) =>
    areaComparisonRows(
      indicator,
      indicator.areaData.filter(({ areaCode }) => areaCode !== 'E92000001'),
      'alphabetical',
    ),
  );
  const other = new Map(data[1]?.rows.map((cell) => [cell.areaCode, cell]));
  const rows = (data[0]?.rows ?? []).map((cell) => ({
    code: cell.areaCode,
    name: cell.areaName,
    values: [cell.value, other.get(cell.areaCode)?.value ?? null],
  }));
  const areas = rows.filter(
    ({ code, values }) => code !== 'E92000001' && values.every((value) => value !== null),
  );
  const displayValue = (value: number | null, index: number) =>
    value === null
      ? 'No data'
      : withUnit(formatCalculatedValue(value), selected[index]?.detail.unit ?? null);
  return {
    periods: data.map((model) => model.period),
    areas,
    england: rows.find(({ code }) => code === 'E92000001'),
    displayValue,
    range: selected.map((_, index) => {
      const values = areas.flatMap((area) =>
        area.values[index] == null ? [] : [area.values[index]],
      );
      return values.length
        ? `${displayValue(Math.min(...values), index)} to ${displayValue(Math.max(...values), index)}`
        : 'No data';
    }),
  };
}

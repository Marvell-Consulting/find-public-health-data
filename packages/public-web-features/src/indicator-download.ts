import { periodLabel, segmentLabel, trendSeries } from './indicator-data';
import type { IndicatorAreaData, IndicatorDetail } from './indicator-loader';

function csvField(value: string | number | null): string {
  if (value === null) {
    return '';
  }
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\n');
}

/** The trend table as downloaded: one row per period and area with count and value. */
export function trendCsv(indicator: IndicatorDetail, areaData: IndicatorAreaData[]): string {
  const rows: (string | number | null)[][] = [
    [
      'Indicator',
      'Area',
      'Period',
      'Count',
      `Calculated value (${indicator.unit.label})`,
      'Lower 95% CI',
      'Upper 95% CI',
    ],
  ];
  for (const data of areaData) {
    for (const observation of trendSeries(data.observations)) {
      rows.push([
        indicator.name,
        data.areaName,
        periodLabel(observation, indicator.yearType),
        observation.count,
        observation.value,
        observation.lowerCi95,
        observation.upperCi95,
      ]);
    }
  }
  return toCsv(rows);
}

/** Every observation for the selected areas, segments and notes included. */
export function allDataCsv(indicator: IndicatorDetail, areaData: IndicatorAreaData[]): string {
  const rows: (string | number | null)[][] = [
    [
      'Indicator',
      'Area',
      'Period',
      'Segment',
      'Count',
      'Denominator',
      `Calculated value (${indicator.unit.label})`,
      'Lower 95% CI',
      'Upper 95% CI',
      'Lower 99.8% CI',
      'Upper 99.8% CI',
      'Value notes',
    ],
  ];
  for (const data of areaData) {
    for (const observation of data.observations) {
      rows.push([
        indicator.name,
        data.areaName,
        periodLabel(observation, indicator.yearType),
        segmentLabel(observation),
        observation.count,
        observation.denominator,
        observation.value,
        observation.lowerCi95,
        observation.upperCi95,
        observation.lowerCi998,
        observation.upperCi998,
        observation.notes.map(({ text }) => text).join('; ') || null,
      ]);
    }
  }
  return toCsv(rows);
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

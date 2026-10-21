export type TrendDirection = 'up' | 'down' | 'right' | null;

/** Direction of the last five valid values, using the existing 2% change threshold. */
export function recentTrendDirection(values: (number | null)[]): TrendDirection {
  const latest = values.filter((value): value is number => value !== null).slice(-5);
  if (latest.length < 5) return null;
  const change = (latest.at(-1) ?? 0) - (latest[0] ?? 0);
  const mean = latest.reduce((sum, value) => sum + value, 0) / latest.length;
  if (mean === 0 || Math.abs(change) < Math.abs(mean) * 0.02) return 'right';
  return change > 0 ? 'up' : 'down';
}

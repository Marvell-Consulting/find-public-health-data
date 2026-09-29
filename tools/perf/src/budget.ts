/** The work one request to a route did: counted by Postgres and by the response, not timed. */
export type Work = {
  /** SQL statements the APIs executed. */
  statements: number;
  /** Shared buffers (8 kB pages) those statements touched, from cache or disk alike. */
  buffers: number;
  /** Rows those statements returned or affected. */
  rows: number;
  /** Decoded response body size. */
  bytes: number;
};

export type Baseline = Record<string, Work>;

/**
 * How far each metric may rise above its baseline before the route fails: a ratio plus a small
 * absolute allowance, so a tiny baseline is not failed by a handful of extra pages or bytes.
 * Statements have none: one more statement per request is the N+1 signal this exists to catch.
 */
export const TOLERANCES: Record<keyof Work, { ratio: number; slack: number }> = {
  statements: { ratio: 1, slack: 0 },
  buffers: { ratio: 1.2, slack: 20 },
  rows: { ratio: 1.2, slack: 20 },
  bytes: { ratio: 1.1, slack: 1024 },
};

const METRICS = Object.keys(TOLERANCES) as (keyof Work)[];

export type Comparison = {
  /** Budgets exceeded, routes with no baseline, and baseline entries no longer measured. */
  failures: string[];
  /** Metrics now well under their baseline, so the baseline could be tightened. */
  notices: string[];
};

export function allowance(metric: keyof Work, baseline: number): number {
  const { ratio, slack } = TOLERANCES[metric];
  return Math.floor(baseline * ratio) + slack;
}

export function compareToBaseline(measured: Baseline, baseline: Baseline): Comparison {
  const failures: string[] = [];
  const notices: string[] = [];

  for (const [route, work] of Object.entries(measured)) {
    const expected = baseline[route];
    if (expected === undefined) {
      failures.push(`${route} has no baseline`);
      continue;
    }
    for (const metric of METRICS) {
      const limit = allowance(metric, expected[metric]);
      if (work[metric] > limit) {
        failures.push(
          `${route} ${metric}: ${work[metric]}, over the budget of ${limit} (baseline ${expected[metric]})`,
        );
      } else if (expected[metric] > allowance(metric, work[metric])) {
        notices.push(
          `${route} ${metric}: ${work[metric]}, well under the baseline of ${expected[metric]}`,
        );
      }
    }
  }

  for (const route of Object.keys(baseline)) {
    if (!(route in measured)) {
      failures.push(`${route} is in the baseline but no longer measured`);
    }
  }

  return { failures, notices };
}

/** Keys sorted, so a regenerated baseline diffs only where a number changed. */
export function serialiseBaseline(baseline: Baseline): string {
  const sorted = Object.fromEntries(
    Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)),
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/** Nearest-rank percentile of a non-empty sample. */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) throw new Error('percentile of an empty sample');
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(rank, 1) - 1] as number;
}

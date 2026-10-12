import { slugify, slugProblem } from '@fphd/utils/slug';

export function parseIndicatorIds(raw: string): number[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw new Error('--excluded-indicators must be a JSON array of positive integers');
  }
  return parsed;
}

/**
 * Fail if any indicator's name gives no usable slug, or two would share one. Pure, so the
 * unit tests need no database.
 */
export function checkSlugs(indicators: readonly { id: number | string; name: string }[]): void {
  const unusable = indicators
    .map(({ id, name }) => ({ id, name, problem: slugProblem(name) }))
    .filter(({ problem }) => problem !== undefined);
  if (unusable.length > 0) {
    const detail = unusable
      .map(({ id, name, problem }) => `  ${id} (${JSON.stringify(name)}): ${problem}`)
      .join('\n');
    throw new Error(
      `${unusable.length} name(s) give no usable slug; rename or exclude them before exporting:\n${detail}`,
    );
  }
  const bySlug = new Map<string, { id: number | string; name: string }[]>();
  for (const { id, name } of indicators) {
    const slug = slugify(name);
    const existing = bySlug.get(slug);
    if (existing) existing.push({ id, name });
    else bySlug.set(slug, [{ id, name }]);
  }
  const collisions = [...bySlug.entries()].filter(([, holders]) => holders.length > 1);
  if (collisions.length > 0) {
    const detail = collisions
      .map(
        ([slug, holders]) =>
          `  ${slug}: ${holders.map((h) => `${h.id} (${JSON.stringify(h.name)})`).join(', ')}`,
      )
      .join('\n');
    throw new Error(
      `${collisions.length} slug(s) would belong to more than one indicator; ` +
        `rename or exclude one of each before exporting:\n${detail}`,
    );
  }
}

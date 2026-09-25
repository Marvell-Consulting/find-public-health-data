import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { z } from '@fphd/config';
import type postgres from 'postgres';

import { findDuplicates } from './parse-topics-file.ts';

const legacySourcesFile = fileURLToPath(
  new URL('../data/legacy-numerator-denominator-sources.json', import.meta.url),
);

const pairSchema = z.object({
  provider: z.string().min(1),
  source: z.string().min(1).nullable(),
});

/** Fingertips' numerator and denominator sources, each as the providers and sources it names. */
const legacySourceMapSchema = z.record(z.string().min(1), z.array(pairSchema));

export type LegacySourceMap = z.infer<typeof legacySourceMapSchema>;

const pairKey = (provider: string, source: string | null) => JSON.stringify([provider, source]);

/** Parses the map, refusing an entry that names one pair twice, which would break the unique pair. */
export function parseLegacySourceMap(data: unknown): LegacySourceMap {
  const result = legacySourceMapSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid legacy source map:\n${z.prettifyError(result.error)}`);
  }

  const problems = Object.entries(result.data).flatMap(([name, pairs]) =>
    findDuplicates(pairs.map(({ provider, source }) => pairKey(provider, source))).map(
      (pair) => `${name} repeats ${pair}`,
    ),
  );

  if (problems.length > 0) throw new Error(`Invalid legacy source map:\n${problems.join('\n')}`);

  return result.data;
}

export function readLegacySourceMap(): LegacySourceMap {
  return parseLegacySourceMap(JSON.parse(readFileSync(legacySourcesFile, 'utf-8')));
}

export interface LegacySourcePair {
  legacyId: string;
  position: number;
  providerId: string;
  sourceId: string | null;
}

/**
 * The core provider and source ids each legacy source stands for, in the map's order. A name
 * the map lacks, or a pair the core data does not hold, stops the load rather than being
 * dropped; the map may name no pairs, as it does for "Not applicable".
 */
export async function mapLegacySources(
  tx: postgres.TransactionSql,
  legacySources: readonly { id: string; name: string }[],
  map: LegacySourceMap,
): Promise<LegacySourcePair[]> {
  const core = await tx<
    { providerId: string; provider: string; sourceId: string | null; source: string | null }[]
  >`
    SELECT p.id AS "providerId", p.name AS provider, s.id AS "sourceId", s.name AS source
    FROM data_provider p
    LEFT JOIN data_provider_source s ON s.provider_id = p.id
  `;
  const coreIds = new Map<string, { providerId: string; sourceId: string | null }>();

  for (const { providerId, provider, sourceId, source } of core) {
    coreIds.set(pairKey(provider, null), { providerId, sourceId: null });
    if (source !== null) coreIds.set(pairKey(provider, source), { providerId, sourceId });
  }

  const unmapped: string[] = [];
  const unlisted = new Set<string>();
  const pairs = legacySources.flatMap(({ id, name }) => {
    const mapped = map[name.trim()];

    if (mapped === undefined) {
      unmapped.push(name.trim());
      return [];
    }

    return mapped.flatMap(({ provider, source }, position) => {
      const ids = coreIds.get(pairKey(provider, source));

      if (ids === undefined) {
        unlisted.add(source === null ? provider : `${provider}: ${source}`);
        return [];
      }

      return [{ legacyId: id, position, ...ids }];
    });
  });

  if (unmapped.length > 0) {
    throw new Error(
      `No mapping for the sources ${unmapped.join('; ')}: add them to data/legacy-numerator-denominator-sources.json`,
    );
  }

  if (unlisted.size > 0) {
    throw new Error(
      `The legacy source map names ${[...unlisted].join('; ')}, which the core data does not hold: add them to data/data-providers.json and run \`db import-core-data\``,
    );
  }

  return pairs;
}

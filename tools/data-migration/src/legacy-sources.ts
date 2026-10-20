import { readFile } from 'node:fs/promises';

import { readGzipCsv } from './csv.ts';

export const LEGACY_MAP_PATH = new URL(
  '../../../packages/db-operations/data/legacy-numerator-denominator-sources.json',
  import.meta.url,
);

/** Each legacy source's id by its trimmed name, read from the seed CSV. */
export async function legacySourceIds(seedDir: string): Promise<Record<string, string>> {
  const path = `${seedDir}/numerator_denominator_source.csv.gz`;
  const result: Record<string, string> = {};
  let header: string[] | undefined;
  let nameIdx = -1;
  let idIdx = -1;
  for await (const row of readGzipCsv(path)) {
    if (header === undefined) {
      header = row;
      nameIdx = header.indexOf('name');
      idIdx = header.indexOf('id');
      continue;
    }
    const name = row[nameIdx];
    const id = row[idIdx];
    if (name !== undefined && id !== undefined) {
      result[name.trim()] = id;
    }
  }
  return result;
}

/**
 * The id for a legacy source name and the provider/source pairs it maps to.
 * Returns [null, []] for a blank or null name.
 * Throws if the name appears in neither the seed nor the legacy map.
 */
export function legacySource(
  name: string | null | undefined,
  ids: Record<string, string>,
  legacyMap: Record<string, unknown[]>,
): [string | null, unknown[]] {
  const key = name?.trim() ?? '';
  if (!key) return [null, []];
  if (!(key in ids)) {
    throw new Error(`No numerator_denominator_source row named ${JSON.stringify(key)} in the seed`);
  }
  if (!(key in legacyMap)) {
    throw new Error(
      `No mapping for the source ${JSON.stringify(key)}: add it to legacy-numerator-denominator-sources.json`,
    );
  }
  return [ids[key] as string, legacyMap[key] as unknown[]];
}

export async function readLegacyMap(): Promise<Record<string, unknown[]>> {
  const content = await readFile(LEGACY_MAP_PATH, 'utf-8');
  return JSON.parse(content) as Record<string, unknown[]>;
}

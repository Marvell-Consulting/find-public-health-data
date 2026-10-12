import type mssql from 'mssql';

import type { fileRecord } from '../files.ts';

export type ExportedFile = Awaited<ReturnType<typeof fileRecord>>;

/** What one stage of the Pholio export learns and the later stages rely on. */
export interface PholioExportContext {
  readonly pool: mssql.ConnectionPool;
  readonly outDir: string;
  /** Approved indicators deliberately left out, with all their data. */
  readonly excludedIndicators: readonly number[];
  /** Filled by the lookups stage. */
  readonly noteTypeCategory: Map<number, string>;
  /** Filled by the geography stage: Pholio's AreaCode to the exported area id. */
  readonly areaIdByPholioCode: Map<string, number>;
  /** Filled by the dimensions stage: every exported dimension value id. */
  readonly dimensionValueIds: Set<number>;
  /** Filled by the indicators stage: every exported indicator id. */
  readonly indicatorIds: Set<number>;
  /** Filled by the indicators stage: each exported indicator's name, for the slug checks. */
  readonly indicatorNames: Map<number, string>;
  /**
   * Filled by the indicators stage: when each exported indicator entered Pholio, the time every
   * row migrated for it carries. The export time would change on every run, so each incremental
   * would rewrite every row and make the migrated version newer than a publisher's.
   */
  readonly indicatorEnteredAt: Map<number, string>;
  /** Counted by the observations stage: rows of the excluded indicators left out. */
  excludedObservations: number;
}

export function createPholioExportContext(
  pool: mssql.ConnectionPool,
  outDir: string,
  excludedIndicators: readonly number[],
): PholioExportContext {
  return {
    pool,
    outDir,
    excludedIndicators,
    noteTypeCategory: new Map(),
    areaIdByPholioCode: new Map(),
    dimensionValueIds: new Set(),
    indicatorIds: new Set(),
    indicatorNames: new Map(),
    indicatorEnteredAt: new Map(),
    excludedObservations: 0,
  };
}

export type StageResult = Partial<Record<string, ExportedFile>>;

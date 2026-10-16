import type mssql from 'mssql';
import type { fileRecord } from '../files.ts';

export type ExportedFile = Awaited<ReturnType<typeof fileRecord>>;
export type StageResult = Partial<Record<string, ExportedFile>>;

export type IndicatorSelection =
  | { kind: 'approved'; indicators: readonly number[] }
  | { kind: 'development-snapshot' };

export interface PholioExportOptions {
  pool: mssql.ConnectionPool;
  outDir: string;
  excludedIndicators: readonly number[];
  indicatorSelection: IndicatorSelection;
}

export interface ObservationExportOptions extends PholioExportOptions {
  noteTypeCategory: ReadonlyMap<number, string>;
  areaIdByPholioCode: ReadonlyMap<string, number>;
  dimensionValueIds: ReadonlySet<number>;
  indicatorIds: ReadonlySet<number>;
  indicatorEnteredAt: ReadonlyMap<number, string>;
}

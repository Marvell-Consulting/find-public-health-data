import { type Database, schema } from '@fphd/db';
import { tidyName } from '@fphd/utils/tidy-name';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import type { DataTableReferences } from './data-table-rows.ts';
import type { DataTableProblem } from './data-upload-contract.ts';
import { draftJoin, draftVersion } from './indicator-repository-sql.ts';

const { area, dimensionType, dimensionValue, indicator, noteType, uploadBatch } = schema;

// Sex and age have columns of their own, so a category never names them.
const SEX = 'Sex';
const AGE = 'Age';

export interface LatestDataUploadRow {
  id: string;
  status: 'processed' | 'failed';
  originalFilename: string;
  uploadedAt: Date;
  problems: DataTableProblem[];
}

/** The indicator's draft version id, null without a draft, undefined with no indicator. */
export async function findDraftVersionId(
  db: Database,
  indicatorId: string,
): Promise<string | null | undefined> {
  const [row] = await db
    .select({ draftId: draftVersion.id })
    .from(indicator)
    .leftJoin(draftVersion, draftJoin)
    .where(eq(indicator.id, indicatorId));

  return row === undefined ? undefined : row.draftId;
}

/** The most recent upload to a draft that finished, whether it loaded or was refused. */
export async function getLatestDataUpload(
  db: Database,
  draftId: string,
): Promise<LatestDataUploadRow | undefined> {
  const [row] = await db
    .select({
      id: uploadBatch.id,
      status: uploadBatch.status,
      originalFilename: uploadBatch.originalFilename,
      uploadedAt: uploadBatch.uploadedAt,
      validationResult: uploadBatch.validationResult,
    })
    .from(uploadBatch)
    .where(
      and(
        eq(uploadBatch.indicatorVersionId, draftId),
        inArray(uploadBatch.status, ['processed', 'failed']),
      ),
    )
    .orderBy(desc(uploadBatch.uploadedAt), desc(uploadBatch.id))
    .limit(1);

  if (row === undefined) return undefined;

  const { validationResult, status, ...upload } = row;
  return {
    ...upload,
    status: status === 'failed' ? 'failed' : 'processed',
    problems: (validationResult as DataTableProblem[] | null) ?? [],
  };
}

/** Every name and code a data table can match, tidied as the file's names are. */
export async function loadDataTableReferences(db: Database): Promise<DataTableReferences> {
  const [areas, values, notes] = await Promise.all([
    db.select({ code: area.code, id: area.id }).from(area).where(isNull(area.validTo)),
    db
      .select({ type: dimensionType.name, name: dimensionValue.name, id: dimensionValue.id })
      .from(dimensionValue)
      .innerJoin(dimensionType, eq(dimensionType.id, dimensionValue.dimensionTypeId)),
    db.select({ text: noteType.text, id: noteType.id }).from(noteType),
  ]);

  const byType = new Map<string, Map<string, string>>();
  for (const { type, name, id } of values) {
    const typeName = tidyName(type);
    byType.set(typeName, (byType.get(typeName) ?? new Map()).set(tidyName(name), id));
  }

  return {
    areaIds: new Map(areas.map(({ code, id }) => [code, id])),
    sexIds: byType.get(SEX) ?? new Map(),
    ageIds: byType.get(AGE) ?? new Map(),
    categoryIds: new Map([...byType].filter(([type]) => type !== SEX && type !== AGE)),
    noteTypeIds: new Map(notes.map(({ text, id }) => [tidyName(text), id])),
  };
}

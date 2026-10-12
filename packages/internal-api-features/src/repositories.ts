import type { Readable } from 'node:stream';

import { type Database, listTopics, type Topic } from '@fphd/db';

import { type CiMethodRow, getCiMethodById, listCiMethods } from './ci-method-repository.ts';
import type { TagOptions, ValueTypeAndUnitOptions } from './contract.ts';
import { type DataProviderRow, listDataProviders } from './data-provider-repository.ts';
import type { DataTableRow } from './data-table-check-contract.ts';
import {
  type ConfirmDataTableResult,
  confirmDataTable,
  type DraftDataTableRow,
  type FindDraftDataTableResult,
  findDraftDataTable,
  listDataTableRows,
} from './data-table-check-repository.ts';
import {
  type DataUpload,
  type ProcessDataUploadResult,
  processDataUpload,
} from './data-upload-load-repository.ts';
import {
  findDraftVersionId,
  getLatestDataUpload,
  type LatestDataUploadRow,
} from './data-upload-repository.ts';
import {
  type CreateIndicatorDraftResult,
  createIndicatorDraft,
  getIndicatorDraftState,
  type IndicatorDraftAttributes,
  type IndicatorDraftStateRow,
  type NewIndicatorDraftAttributes,
  type UpdateIndicatorDraftResult,
  updateIndicatorDraft,
} from './indicator-draft-repository.ts';
import {
  getIndicatorById,
  type IndicatorAdminDetailRow,
  type IndicatorAdminRows,
  listIndicatorsPage,
} from './indicator-list-repository.ts';
import {
  type CreateDraftFromPublishedResult,
  createDraftFromPublished,
} from './indicator-publish-repository.ts';
import type { IndicatorDraftLists } from './indicator-version-lists-repository.ts';
import { listTagOptions } from './tag-repository.ts';
import {
  type CreateTopicResult,
  createTopic,
  type DeleteTopicResult,
  deleteTopic,
  getTopicById,
  type TopicUpdate,
  type UpdateTopicResult,
  updateTopic,
} from './topic-repository.ts';
import { listValueTypeAndUnitOptions } from './value-type-and-unit-repository.ts';

/** The publisher's topic surface: the public listing plus the writes only `internal_api` makes. */
export interface InternalTopicRepository {
  list(): Promise<Topic[]>;
  findById(id: string): Promise<Topic | undefined>;
  create(values: TopicUpdate): Promise<CreateTopicResult>;
  update(id: string, values: TopicUpdate): Promise<UpdateTopicResult>;
  delete(id: string): Promise<DeleteTopicResult>;
}

/** The publisher's view of indicators: every status, unlike the public repository. */
export interface InternalIndicatorRepository {
  listPage(page: number, pageSize: number): Promise<IndicatorAdminRows>;
  findById(id: string): Promise<IndicatorAdminDetailRow | undefined>;
  /** The draft and whether anything is published, read together for the task list. */
  findDraftState(id: string): Promise<IndicatorDraftStateRow | undefined>;
  createDraft(
    attributes: NewIndicatorDraftAttributes,
    actor: string,
  ): Promise<CreateIndicatorDraftResult>;
  updateDraft(
    indicatorId: string,
    attributes: IndicatorDraftAttributes,
    lists: IndicatorDraftLists,
    actor: string,
  ): Promise<UpdateIndicatorDraftResult>;
  /** Opens a draft from the published version, copying its columns and lists. */
  draftFromPublished(indicatorId: string, actor: string): Promise<CreateDraftFromPublishedResult>;
}

/** The confidence interval methods a publisher chooses from. */
export interface InternalCiMethodRepository {
  list(): Promise<CiMethodRow[]>;
  findById(id: string): Promise<CiMethodRow | undefined>;
}

/** The topics and classifications a publisher tags an indicator with. */
export interface InternalTagRepository {
  listOptions(): Promise<TagOptions>;
}

/** The providers of data, and their sources, a publisher chooses from. */
export interface InternalDataProviderRepository {
  list(): Promise<DataProviderRow[]>;
}

/**
 * A draft's data table uploads: loading a stored file, the outcome of the latest, and checking
 * the loaded table.
 */
export interface InternalDataUploadRepository {
  /** The indicator's draft version id, null without a draft, undefined with no indicator. */
  findDraftId(indicatorId: string): Promise<string | null | undefined>;
  findLatest(draftId: string): Promise<LatestDataUploadRow | undefined>;
  process(
    upload: DataUpload,
    openFile: () => Promise<Readable>,
    signal: AbortSignal,
  ): Promise<ProcessDataUploadResult>;
  findDraftDataTable(indicatorId: string): Promise<FindDraftDataTableResult>;
  listRows(
    batch: Pick<DraftDataTableRow, 'batchId' | 'rowCount'>,
    page: number,
    rowsPerPage: number,
  ): Promise<DataTableRow[]>;
  /** Confirms the draft's data table while it is still the batch named. */
  confirm(indicatorId: string, batchId: string, actor: string): Promise<ConfirmDataTableResult>;
}

/** The value types and units a publisher chooses from. */
export interface InternalValueTypeAndUnitRepository {
  listOptions(): Promise<ValueTypeAndUnitOptions>;
}

/**
 * Everything the internal-only routes read and write, mirroring `Repositories` in `@fphd/db`.
 * Queries live here so the artefact-boundary check keeps them out of the public image.
 */
export interface InternalRepositories {
  ciMethods: InternalCiMethodRepository;
  dataProviders: InternalDataProviderRepository;
  dataUploads: InternalDataUploadRepository;
  indicators: InternalIndicatorRepository;
  tags: InternalTagRepository;
  topics: InternalTopicRepository;
  valueTypesAndUnits: InternalValueTypeAndUnitRepository;
}

export function createInternalRepositories(db: Database): InternalRepositories {
  return {
    ciMethods: {
      list: () => listCiMethods(db),
      findById: (id) => getCiMethodById(db, id),
    },
    dataProviders: {
      list: () => listDataProviders(db),
    },
    dataUploads: {
      findDraftId: (indicatorId) => findDraftVersionId(db, indicatorId),
      findLatest: (draftId) => getLatestDataUpload(db, draftId),
      process: (upload, openFile, signal) => processDataUpload(db, upload, openFile, signal),
      findDraftDataTable: (indicatorId) => findDraftDataTable(db, indicatorId),
      listRows: (batch, page, rowsPerPage) => listDataTableRows(db, batch, page, rowsPerPage),
      confirm: (indicatorId, batchId, actor) => confirmDataTable(db, indicatorId, batchId, actor),
    },
    indicators: {
      listPage: (page, pageSize) => listIndicatorsPage(db, page, pageSize),
      findById: (id) => getIndicatorById(db, id),
      findDraftState: (id) => getIndicatorDraftState(db, id),
      createDraft: (attributes, actor) => createIndicatorDraft(db, attributes, actor),
      updateDraft: (indicatorId, attributes, lists, actor) =>
        updateIndicatorDraft(db, indicatorId, attributes, lists, actor),
      draftFromPublished: (indicatorId, actor) => createDraftFromPublished(db, indicatorId, actor),
    },
    tags: {
      listOptions: () => listTagOptions(db),
    },
    topics: {
      list: () => listTopics(db),
      findById: (id) => getTopicById(db, id),
      create: (values) => createTopic(db, values),
      update: (id, values) => updateTopic(db, id, values),
      delete: (id) => deleteTopic(db, id),
    },
    valueTypesAndUnits: {
      listOptions: () => listValueTypeAndUnitOptions(db),
    },
  };
}

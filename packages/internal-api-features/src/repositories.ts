import { type Database, listTopics, type Topic } from '@fphd/db';

import { type CiMethodRow, getCiMethodById, listCiMethods } from './ci-method-repository.ts';
import type { TagOptions, ValueTypeAndUnitOptions } from './contract.ts';
import { type DataProviderRow, listDataProviders } from './data-provider-repository.ts';
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

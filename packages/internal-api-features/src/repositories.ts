import { type Database, listTopics, type Topic } from '@fphd/db';

import {
  type CreateDraftFromPublishedResult,
  type CreateIndicatorDraftResult,
  createDraftFromPublished,
  createIndicatorDraft,
  getIndicatorById,
  getIndicatorDraftState,
  type IndicatorAdminDetailRow,
  type IndicatorAdminRows,
  type IndicatorDraftAttributes,
  type IndicatorDraftMemberships,
  type IndicatorDraftStateRow,
  listIndicatorsPage,
  type NewIndicatorDraftAttributes,
  type UpdateIndicatorDraftResult,
  updateIndicatorDraft,
} from './indicator-repository.ts';
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
    memberships: IndicatorDraftMemberships,
    actor: string,
  ): Promise<UpdateIndicatorDraftResult>;
  /** Opens a draft from the published version, copying its columns and memberships. */
  draftFromPublished(indicatorId: string, actor: string): Promise<CreateDraftFromPublishedResult>;
}

/**
 * Everything the internal-only routes read and write, mirroring `Repositories` in `@fphd/db`.
 * Queries live here so the artefact-boundary check keeps them out of the public image.
 */
export interface InternalRepositories {
  indicators: InternalIndicatorRepository;
  topics: InternalTopicRepository;
}

export function createInternalRepositories(db: Database): InternalRepositories {
  return {
    indicators: {
      listPage: (page, pageSize) => listIndicatorsPage(db, page, pageSize),
      findById: (id) => getIndicatorById(db, id),
      findDraftState: (id) => getIndicatorDraftState(db, id),
      createDraft: (attributes, actor) => createIndicatorDraft(db, attributes, actor),
      updateDraft: (indicatorId, attributes, memberships, actor) =>
        updateIndicatorDraft(db, indicatorId, attributes, memberships, actor),
      draftFromPublished: (indicatorId, actor) => createDraftFromPublished(db, indicatorId, actor),
    },
    topics: {
      list: () => listTopics(db),
      findById: (id) => getTopicById(db, id),
      create: (values) => createTopic(db, values),
      update: (id, values) => updateTopic(db, id, values),
      delete: (id) => deleteTopic(db, id),
    },
  };
}

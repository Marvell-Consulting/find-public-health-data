import { type Database, listTopics, type Topic } from '@fphd/db';

import { type IndicatorAdminRows, listIndicatorsPage } from './indicator-repository.js';
import {
  type CreateTopicResult,
  createTopic,
  type DeleteTopicResult,
  deleteTopic,
  getTopicById,
  type TopicUpdate,
  type UpdateTopicResult,
  updateTopic,
} from './topic-repository.js';

/** The publisher's topic surface: the public listing plus the writes only `internal_api` makes. */
export interface InternalTopicRepository {
  list(): Promise<Topic[]>;
  findById(id: string): Promise<Topic | undefined>;
  create(values: TopicUpdate): Promise<CreateTopicResult>;
  update(id: string, values: TopicUpdate): Promise<UpdateTopicResult>;
  delete(id: string): Promise<DeleteTopicResult>;
}

/** The dashboard's view of indicators: every status, unlike the public repository. */
export interface InternalIndicatorRepository {
  listPage(page: number, pageSize: number): Promise<IndicatorAdminRows>;
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

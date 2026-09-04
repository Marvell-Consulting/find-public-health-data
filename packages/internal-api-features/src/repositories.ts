import { type Database, listTopics, type Topic } from '@fphd/db';

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

/** The publisher's topic surface: the public listing plus the writes only `internal_api` may make. */
export interface InternalTopicRepository {
  list(): Promise<Topic[]>;
  findById(id: string): Promise<Topic | undefined>;
  create(values: TopicUpdate): Promise<CreateTopicResult>;
  update(id: string, values: TopicUpdate): Promise<UpdateTopicResult>;
  delete(id: string): Promise<DeleteTopicResult>;
}

/**
 * Everything the internal-only routes read and write, mirroring `Repositories` in `@fphd/db`.
 * Queries live in this package rather than `@fphd/db` so they cannot reach the public image.
 */
export interface InternalRepositories {
  topics: InternalTopicRepository;
}

export function createInternalRepositories(db: Database): InternalRepositories {
  return {
    topics: {
      list: () => listTopics(db),
      findById: (id) => getTopicById(db, id),
      create: (values) => createTopic(db, values),
      update: (id, values) => updateTopic(db, id, values),
      delete: (id) => deleteTopic(db, id),
    },
  };
}

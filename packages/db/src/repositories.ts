import type { Database } from './client.js';
import { type ApprovedIndicator, listApprovedIndicators } from './indicator-repository.js';
import { listTopics, type Topic } from './topic-repository.js';

export interface IndicatorRepository {
  listApproved(): Promise<ApprovedIndicator[]>;
}

export interface TopicRepository {
  list(): Promise<Topic[]>;
}

/**
 * The database-backed services an app is given at startup. One prop per architectural
 * concern rather than one per feature: adding an endpoint adds a method or a repository
 * here, and no app factory or test signature changes.
 */
export interface Repositories {
  indicators: IndicatorRepository;
  topics: TopicRepository;
}

export function createRepositories(db: Database): Repositories {
  return {
    indicators: {
      listApproved: () => listApprovedIndicators(db),
    },
    topics: {
      list: () => listTopics(db),
    },
  };
}

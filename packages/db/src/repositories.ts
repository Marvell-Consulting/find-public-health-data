import { type AreaSummary, listAreasByType } from './area-repository.js';
import type { Database } from './client.js';
import {
  type ApprovedIndicator,
  getApprovedIndicatorByFingertipsId,
  getIndicatorObservations,
  type IndicatorAreaData,
  type IndicatorDetail,
  listApprovedIndicators,
  searchApprovedIndicators,
} from './indicator-repository.js';
import { getTopicBySlug, listTopics, type Topic } from './topic-repository.js';

export interface IndicatorRepository {
  listApproved(): Promise<ApprovedIndicator[]>;
  search(query: string, limit: number): Promise<ApprovedIndicator[]>;
  findApprovedByFingertipsId(fingertipsId: number): Promise<IndicatorDetail | undefined>;
  findObservations(fingertipsId: number, areaCode: string): Promise<IndicatorAreaData | undefined>;
}

export interface AreaRepository {
  listByType(areaTypeName: string): Promise<AreaSummary[]>;
}

export interface TopicRepository {
  list(): Promise<Topic[]>;
  findBySlug(slug: string): Promise<Topic | undefined>;
}

/**
 * The database-backed services an app is given at startup. One prop per architectural
 * concern rather than one per feature: adding an endpoint adds a method or a repository
 * here, and no app factory or test signature changes.
 */
export interface Repositories {
  areas: AreaRepository;
  indicators: IndicatorRepository;
  topics: TopicRepository;
}

export function createRepositories(db: Database): Repositories {
  return {
    areas: {
      listByType: (areaTypeName) => listAreasByType(db, areaTypeName),
    },
    indicators: {
      listApproved: () => listApprovedIndicators(db),
      search: (query, limit) => searchApprovedIndicators(db, query, limit),
      findApprovedByFingertipsId: (fingertipsId) =>
        getApprovedIndicatorByFingertipsId(db, fingertipsId),
      findObservations: (fingertipsId, areaCode) =>
        getIndicatorObservations(db, fingertipsId, areaCode),
    },
    topics: {
      list: () => listTopics(db),
      findBySlug: (slug) => getTopicBySlug(db, slug),
    },
  };
}

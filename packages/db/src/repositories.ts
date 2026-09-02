import {
  type AreaLookup,
  type AreaParent,
  type AreaSummary,
  listAreaParents,
  listAreasByCodes,
  listAreasByType,
  searchAreas,
} from './area-repository.js';
import type { Database } from './client.js';
import {
  type ApprovedIndicator,
  getApprovedIndicatorByFingertipsId,
  getIndicatorObservations,
  getObservationRange,
  type IndicatorAreaData,
  type IndicatorDetail,
  listApprovedIndicators,
  type ObservationRangePeriod,
  searchApprovedIndicators,
} from './indicator-repository.js';
import { getTopicBySlug, listTopics, type Topic } from './topic-repository.js';

export interface IndicatorRepository {
  listApproved(): Promise<ApprovedIndicator[]>;
  search(query: string, limit: number): Promise<ApprovedIndicator[]>;
  findApprovedByFingertipsId(fingertipsId: number): Promise<IndicatorDetail | undefined>;
  findObservations(fingertipsId: number, areaCode: string): Promise<IndicatorAreaData | undefined>;
  findObservationRange(
    fingertipsId: number,
    areaTypeNames: string[],
  ): Promise<ObservationRangePeriod[]>;
}

export interface AreaRepository {
  listByType(areaTypeName: string): Promise<AreaSummary[]>;
  listByCodes(codes: string[]): Promise<AreaLookup[]>;
  search(query: string, areaTypeNames: string[], limit: number): Promise<AreaLookup[]>;
  listParents(childCodes: string[], parentTypeName: string): Promise<AreaParent[]>;
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
      listByCodes: (codes) => listAreasByCodes(db, codes),
      search: (query, areaTypeNames, limit) => searchAreas(db, query, areaTypeNames, limit),
      listParents: (childCodes, parentTypeName) => listAreaParents(db, childCodes, parentTypeName),
    },
    indicators: {
      listApproved: () => listApprovedIndicators(db),
      search: (query, limit) => searchApprovedIndicators(db, query, limit),
      findApprovedByFingertipsId: (fingertipsId) =>
        getApprovedIndicatorByFingertipsId(db, fingertipsId),
      findObservations: (fingertipsId, areaCode) =>
        getIndicatorObservations(db, fingertipsId, areaCode),
      findObservationRange: (fingertipsId, areaTypeNames) =>
        getObservationRange(db, fingertipsId, areaTypeNames),
    },
    topics: {
      list: () => listTopics(db),
      findBySlug: (slug) => getTopicBySlug(db, slug),
    },
  };
}

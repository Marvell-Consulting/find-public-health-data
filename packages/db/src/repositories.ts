import {
  type AreaLookup,
  type AreaParent,
  type AreaSummary,
  listAreaParents,
  listAreasByCodes,
  listAreasByGroup,
  listAreasByType,
  listDisplayGroups,
  searchAreas,
} from './area-repository.js';
import type { Database } from './client.js';
import {
  type ApprovedIndicator,
  getApprovedIndicatorById,
  getIndicatorObservations,
  getObservationRange,
  type IndicatorAreaData,
  type IndicatorDetail,
  listApprovedIndicators,
  type ObservationRangePeriod,
  resolveApprovedIndicatorId,
  searchApprovedIndicators,
} from './indicator-repository.js';
import { getTopicBySlug, listTopics, type Topic } from './topic-repository.js';

export interface IndicatorRepository {
  listApproved(): Promise<ApprovedIndicator[]>;
  search(query: string, limit: number): Promise<ApprovedIndicator[]>;
  /** The one place the public Fingertips number resolves to an internal id. */
  resolveId(fingertipsId: number): Promise<string | undefined>;
  findApprovedById(indicatorId: string): Promise<IndicatorDetail | undefined>;
  findObservations(indicatorId: string, areaCode: string): Promise<IndicatorAreaData | undefined>;
  findObservationRange(
    indicatorId: string,
    displayGroup: string,
  ): Promise<ObservationRangePeriod[]>;
}

export interface AreaRepository {
  listByType(areaTypeName: string): Promise<AreaSummary[]>;
  listDisplayGroups(): Promise<string[]>;
  listByGroup(displayGroup: string): Promise<AreaSummary[]>;
  listByCodes(codes: string[]): Promise<AreaLookup[]>;
  search(query: string, limit: number): Promise<AreaLookup[]>;
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
      listDisplayGroups: () => listDisplayGroups(db),
      listByGroup: (displayGroup) => listAreasByGroup(db, displayGroup),
      listByCodes: (codes) => listAreasByCodes(db, codes),
      search: (query, limit) => searchAreas(db, query, limit),
      listParents: (childCodes, parentTypeName) => listAreaParents(db, childCodes, parentTypeName),
    },
    indicators: {
      listApproved: () => listApprovedIndicators(db),
      search: (query, limit) => searchApprovedIndicators(db, query, limit),
      resolveId: (fingertipsId) => resolveApprovedIndicatorId(db, fingertipsId),
      findApprovedById: (indicatorId) => getApprovedIndicatorById(db, indicatorId),
      findObservations: (indicatorId, areaCode) =>
        getIndicatorObservations(db, indicatorId, areaCode),
      findObservationRange: (indicatorId, displayGroup) =>
        getObservationRange(db, indicatorId, displayGroup),
    },
    topics: {
      list: () => listTopics(db),
      findBySlug: (slug) => getTopicBySlug(db, slug),
    },
  };
}

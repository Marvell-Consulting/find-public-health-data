import type { IndicatorSearchFilters, Repositories } from '@fphd/db';
import { Router } from 'express';

import type {
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorFacets,
  IndicatorSearchResult,
} from './contract.js';
import {
  DEFAULT_INDICATOR_SEARCH_RESULTS,
  MAX_FILTER_LABEL_LENGTH,
  MAX_FILTER_VALUE_LENGTH,
  MAX_FILTER_VALUES,
  MAX_INDICATOR_FILTER_RESULTS,
  MAX_INDICATOR_QUERY_LENGTH,
  MAX_INDICATOR_SEARCH_RESULTS,
  MAX_SELECTED_AREAS,
  pickAreaCodes,
} from './contract.js';

const DEFAULT_AREA_CODE = 'E92000001';

function pickStrings(value: unknown, maxLength = MAX_FILTER_VALUE_LENGTH): string[] {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [value]).filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry !== '' && entry.length <= maxLength,
      ),
    ),
  ].slice(0, MAX_FILTER_VALUES);
}

export function indicatorsRouter(indicators: Repositories['indicators']): Router {
  const router = Router();

  router.get('/api/indicators/facets', async (_request, response) => {
    const facets: IndicatorFacets = await indicators.listFacets();
    response.status(200).json(facets);
  });

  router.get('/api/indicators/search', async (request, response) => {
    const { q } = request.query;
    const query = typeof q === 'string' ? q.trim().slice(0, MAX_INDICATOR_QUERY_LENGTH) : '';

    const filters: IndicatorSearchFilters = {
      query,
      topics: pickStrings(request.query.t),
      indicatorTypes: pickStrings(request.query.it),
      riskFactors: pickStrings(request.query.rf),
      frameworks: pickStrings(request.query.fw),
      populations: pickStrings(request.query.pg),
      inequalities: pickStrings(request.query.eq),
      displayGroups: pickStrings(request.query.displayGroup),
      areaCodes: pickAreaCodes(request.query.areaCode, MAX_SELECTED_AREAS),
      sources: pickStrings(request.query.src, MAX_FILTER_LABEL_LENGTH),
      valueTypes: pickStrings(request.query.vt),
      yearTypes: pickStrings(request.query.per),
      limit: MAX_INDICATOR_FILTER_RESULTS,
    };

    const result: IndicatorSearchResult = await indicators.searchWithFilters(filters);
    response.status(200).json(result);
  });

  router.get('/api/indicators', async (request, response) => {
    const { q, limit } = request.query;
    const query = typeof q === 'string' ? q.trim().slice(0, MAX_INDICATOR_QUERY_LENGTH) : '';
    if (query) {
      const capped =
        typeof limit === 'string' && /^[1-9]\d*$/.test(limit)
          ? Math.min(Number(limit), MAX_INDICATOR_SEARCH_RESULTS)
          : DEFAULT_INDICATOR_SEARCH_RESULTS;
      response.status(200).json({ indicators: await indicators.search(query, capped) });
      return;
    }
    response.status(200).json({ indicators: await indicators.listApproved() });
  });

  router.get('/api/indicators/:fingertipsId/data', async (request, response) => {
    const { fingertipsId } = request.params;
    // Repeatable, so a page comparing many areas asks once rather than once per area.
    const requested = request.query.areaCode ?? DEFAULT_AREA_CODE;
    const areaCodes = pickAreaCodes(requested);

    if (!/^\d+$/.test(fingertipsId) || areaCodes.length === 0) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const indicatorId = await indicators.resolveId(Number(fingertipsId));
    if (!indicatorId) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const found = await Promise.all(
      areaCodes.map((code) => indicators.findObservations(indicatorId, code)),
    );
    const data: IndicatorAreaData[] = found.filter(
      (entry): entry is IndicatorAreaData => entry !== undefined,
    );

    // The indicator is known, so every requested area missing means unknown areas.
    if (data.length === 0) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    // A single area answers with the bare object it always has; several answer with a list.
    response.status(200).json(areaCodes.length === 1 ? data[0] : data);
  });

  router.get('/api/indicators/:fingertipsId/range', async (request, response) => {
    const { fingertipsId } = request.params;
    const displayGroup = request.query.displayGroup;

    if (
      !/^\d+$/.test(fingertipsId) ||
      typeof displayGroup !== 'string' ||
      displayGroup === '' ||
      displayGroup.length > 100
    ) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const indicatorId = await indicators.resolveId(Number(fingertipsId));
    if (!indicatorId) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    // An indicator with no data at this level answers with an empty range rather than an
    // error, matching how /api/areas treats unknown groups.
    response.status(200).json({
      periods: await indicators.findObservationRange(indicatorId, displayGroup),
    });
  });

  router.get('/api/indicators/:fingertipsId', async (request, response) => {
    const { fingertipsId } = request.params;

    // The public identifier is a plain integer; anything else can only be a probe or a
    // typo, and answering 404 keeps both indistinguishable from an unknown indicator.
    if (!/^\d+$/.test(fingertipsId)) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const indicatorId = await indicators.resolveId(Number(fingertipsId));
    if (!indicatorId) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    // The annotation binds the repository's shape to the wire contract at compile time.
    const detail: IndicatorDetail | undefined = await indicators.findApprovedById(indicatorId);

    if (!detail) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    response.status(200).json(detail);
  });

  return router;
}

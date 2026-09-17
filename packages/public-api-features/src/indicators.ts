import type { IndicatorSearchFilters, Repositories } from '@fphd/db';
import { type Request, type Response, Router } from 'express';

import type {
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorFacets,
  IndicatorSearchResult,
} from './contract.js';

const DEFAULT_AREA_CODE = 'E92000001';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 100;
// Longer than any indicator name, so truncation can never hide a legitimate match.
const MAX_QUERY_LENGTH = 200;
// Source values are labels rather than slugs, but still need a finite request boundary.
const MAX_FILTER_LABEL_LENGTH = 500;
const SEARCH_PAGE_LIMIT = 200;
const AREA_CODE_RE = /^[A-Z0-9]+$/i;

function pickStrings(value: unknown, maxLength = 100): string[] {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [value]).filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry !== '' && entry.length <= maxLength,
      ),
    ),
  ].slice(0, 100);
}

/**
 * An indicator answers to its number and to every slug it has been published under, but it
 * has one canonical address. Anything else redirects rather than serving the same body at
 * two URLs, so a link shared from a Fingertips-era URL still arrives.
 */
function redirectToCanonical(
  request: Request,
  response: Response,
  alias: string,
  canonical: string,
  suffix: string,
): boolean {
  if (alias === canonical) {
    return false;
  }

  const queryIndex = request.originalUrl.indexOf('?');
  const search = queryIndex === -1 ? '' : request.originalUrl.slice(queryIndex);
  response.redirect(301, `/api/indicators/${encodeURIComponent(canonical)}${suffix}${search}`);

  return true;
}

export function indicatorsRouter(indicators: Repositories['indicators']): Router {
  const router = Router();

  router.get('/api/indicators/facets', async (_request, response) => {
    const facets: IndicatorFacets = await indicators.listFacets();
    response.status(200).json(facets);
  });

  router.get('/api/indicators/search', async (request, response) => {
    const { q } = request.query;
    const query = typeof q === 'string' ? q.trim().slice(0, MAX_QUERY_LENGTH) : '';

    const filters: IndicatorSearchFilters = {
      query,
      topics: pickStrings(request.query.t),
      indicatorTypes: pickStrings(request.query.it),
      riskFactors: pickStrings(request.query.rf),
      frameworks: pickStrings(request.query.fw),
      populations: pickStrings(request.query.pg),
      inequalities: pickStrings(request.query.eq),
      displayGroups: pickStrings(request.query.displayGroup),
      areaCodes: pickStrings(request.query.areaCode).filter((code) => AREA_CODE_RE.test(code)),
      sources: pickStrings(request.query.src, MAX_FILTER_LABEL_LENGTH),
      valueTypes: pickStrings(request.query.vt),
      yearTypes: pickStrings(request.query.per),
      limit: SEARCH_PAGE_LIMIT,
    };

    const result: IndicatorSearchResult = await indicators.searchWithFilters(filters);
    response.status(200).json(result);
  });

  router.get('/api/indicators', async (request, response) => {
    const { q, limit } = request.query;
    const query = typeof q === 'string' ? q.trim().slice(0, MAX_QUERY_LENGTH) : '';
    if (query) {
      const capped =
        typeof limit === 'string' && /^[1-9]\d*$/.test(limit)
          ? Math.min(Number(limit), MAX_SEARCH_LIMIT)
          : DEFAULT_SEARCH_LIMIT;
      response.status(200).json({ indicators: await indicators.search(query, capped) });
      return;
    }
    response.status(200).json({ indicators: await indicators.listApproved() });
  });

  router.get('/api/indicators/:alias/data', async (request, response) => {
    const { alias } = request.params;
    // Repeatable, so a page comparing many areas asks once rather than once per area.
    const requested = request.query.areaCode ?? DEFAULT_AREA_CODE;
    const areaCodes = [...new Set(Array.isArray(requested) ? requested : [requested])].filter(
      (code): code is string => typeof code === 'string' && /^[A-Z0-9]+$/i.test(code),
    );

    if (areaCodes.length === 0) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const resolved = await indicators.resolveAlias(alias);
    if (!resolved) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    if (redirectToCanonical(request, response, alias, resolved.slug, '/data')) {
      return;
    }

    const found = await Promise.all(
      areaCodes.map((code) => indicators.findObservations(resolved.id, code)),
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

  router.get('/api/indicators/:alias/range', async (request, response) => {
    const { alias } = request.params;
    const displayGroup = request.query.displayGroup;

    if (typeof displayGroup !== 'string' || displayGroup === '' || displayGroup.length > 100) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const resolved = await indicators.resolveAlias(alias);
    if (!resolved) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    if (redirectToCanonical(request, response, alias, resolved.slug, '/range')) {
      return;
    }

    // An indicator with no data at this level answers with an empty range rather than an
    // error, matching how /api/areas treats unknown groups.
    response.status(200).json({
      periods: await indicators.findObservationRange(resolved.id, displayGroup),
    });
  });

  router.get('/api/indicators/:alias', async (request, response) => {
    const { alias } = request.params;

    const resolved = await indicators.resolveAlias(alias);
    if (!resolved) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    if (redirectToCanonical(request, response, alias, resolved.slug, '')) {
      return;
    }

    // The annotation binds the repository's shape to the wire contract at compile time.
    const detail: IndicatorDetail | undefined = await indicators.findApprovedById(resolved.id);

    if (!detail) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    response.status(200).json(detail);
  });

  return router;
}

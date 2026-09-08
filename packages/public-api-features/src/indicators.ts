import type { Repositories } from '@fphd/db';
import { Router } from 'express';

import type { IndicatorAreaData, IndicatorDetail } from './contract.js';

const DEFAULT_AREA_CODE = 'E92000001';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 100;
// Longer than any indicator name, so truncation can never hide a legitimate match.
const MAX_QUERY_LENGTH = 200;

export function indicatorsRouter(indicators: Repositories['indicators']): Router {
  const router = Router();

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

  router.get('/api/indicators/:fingertipsId/data', async (request, response) => {
    const { fingertipsId } = request.params;
    // Repeatable, so a page comparing many areas asks once rather than once per area.
    const requested = request.query.area_code ?? DEFAULT_AREA_CODE;
    const areaCodes = [...new Set(Array.isArray(requested) ? requested : [requested])].filter(
      (code): code is string => typeof code === 'string' && /^[A-Z0-9]+$/i.test(code),
    );

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
    const requested = request.query.area_type;
    const areaTypeNames = (Array.isArray(requested) ? requested : [requested]).filter(
      (value): value is string => typeof value === 'string' && value !== '' && value.length <= 100,
    );

    if (!/^\d+$/.test(fingertipsId) || areaTypeNames.length === 0) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const indicatorId = await indicators.resolveId(Number(fingertipsId));
    if (!indicatorId) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    // An indicator with no data for these area types answers with an empty range rather
    // than an error, matching how /api/areas treats unknown types.
    response.status(200).json({
      periods: await indicators.findObservationRange(indicatorId, areaTypeNames),
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

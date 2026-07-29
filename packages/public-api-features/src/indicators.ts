import type { Repositories } from '@fphd/db';
import { Router } from 'express';

import type { IndicatorAreaData, IndicatorDetail } from './contract.js';

const DEFAULT_AREA_CODE = 'E92000001';

export function indicatorsRouter(indicators: Repositories['indicators']): Router {
  const router = Router();

  router.get('/api/indicators', async (_request, response) => {
    response.status(200).json({ indicators: await indicators.listApproved() });
  });

  router.get('/api/indicators/:fingertipsId/data', async (request, response) => {
    const { fingertipsId } = request.params;
    const areaCode = request.query.area_code ?? DEFAULT_AREA_CODE;

    if (
      !/^\d+$/.test(fingertipsId) ||
      typeof areaCode !== 'string' ||
      !/^[A-Z0-9]+$/i.test(areaCode)
    ) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    const data: IndicatorAreaData | undefined = await indicators.findObservations(
      Number(fingertipsId),
      areaCode,
    );

    if (!data) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    response.status(200).json(data);
  });

  router.get('/api/indicators/:fingertipsId', async (request, response) => {
    const { fingertipsId } = request.params;

    // The public identifier is a plain integer; anything else can only be a probe or a
    // typo, and answering 404 keeps both indistinguishable from an unknown indicator.
    if (!/^\d+$/.test(fingertipsId)) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    // The annotation binds the repository's shape to the wire contract at compile time.
    const detail: IndicatorDetail | undefined = await indicators.findApprovedByFingertipsId(
      Number(fingertipsId),
    );

    if (!detail) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    response.status(200).json(detail);
  });

  return router;
}

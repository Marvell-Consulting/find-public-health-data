import type { Repositories } from '@fphd/db';
import { Router } from 'express';

export function indicatorsRouter(indicators: Repositories['indicators']): Router {
  const router = Router();

  router.get('/api/indicators', async (_request, response) => {
    response.status(200).json({ indicators: await indicators.listApproved() });
  });

  return router;
}

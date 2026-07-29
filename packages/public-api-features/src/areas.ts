import type { Repositories } from '@fphd/db';
import { Router } from 'express';

export function areasRouter(areas: Repositories['areas']): Router {
  const router = Router();

  router.get('/api/areas', async (request, response) => {
    const areaTypeName = request.query.area_type;

    if (typeof areaTypeName !== 'string' || areaTypeName === '' || areaTypeName.length > 100) {
      response.status(400).json({ error: 'area_type_required' });
      return;
    }

    // An unknown area type is an empty list, not an error — the caller cannot know which
    // types exist without asking, and the indicator detail already scopes what it offers.
    response.status(200).json(await areas.listByType(areaTypeName));
  });

  return router;
}

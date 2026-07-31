import type { Repositories } from '@fphd/db';
import { Router } from 'express';

export function areasRouter(areas: Repositories['areas']): Router {
  const router = Router();

  router.get('/api/areas', async (request, response) => {
    const areaType = request.query.area_type;
    const areaTypeNames = (Array.isArray(areaType) ? areaType : [areaType]).filter(
      (value): value is string => typeof value === 'string' && value !== '' && value.length <= 100,
    );

    if (areaTypeNames.length === 0) {
      response.status(400).json({ error: 'area_type_required' });
      return;
    }

    // An unknown area type is an empty group, not an error — the caller cannot know which
    // types exist without asking, and the indicator detail already scopes what it offers.
    const groups = await Promise.all(
      areaTypeNames.map(async (name) => ({ areaType: name, areas: await areas.listByType(name) })),
    );

    // Asking by repeated parameter always answers with groups, so a caller's parsing does
    // not change with how many types it happened to ask for.
    response.status(200).json(groups);
  });

  return router;
}

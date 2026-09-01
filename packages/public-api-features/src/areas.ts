import type { Repositories } from '@fphd/db';
import { Router } from 'express';

export function areasRouter(areas: Repositories['areas']): Router {
  const router = Router();

  router.get('/api/areas/parents', async (request, response) => {
    const requestedCodes = request.query.area_code;
    const codes = [
      ...new Set(Array.isArray(requestedCodes) ? requestedCodes : [requestedCodes]),
    ].filter((code): code is string => typeof code === 'string' && /^[A-Z0-9]+$/i.test(code));
    const parentType = request.query.parent_type;

    if (
      codes.length === 0 ||
      typeof parentType !== 'string' ||
      parentType === '' ||
      parentType.length > 100
    ) {
      response.status(400).json({ error: 'area_code_and_parent_type_required' });
      return;
    }

    // Areas without a parent of the requested type are simply absent from the answer.
    response.status(200).json(await areas.listParents(codes, parentType));
  });

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

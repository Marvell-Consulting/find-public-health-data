import type { Repositories } from '@fphd/db';
import { Router } from 'express';

export function areasRouter(areas: Repositories['areas']): Router {
  const router = Router();

  router.get('/api/areas/display-groups', async (_request, response) => {
    response.status(200).json(await areas.listDisplayGroups());
  });

  router.get('/api/areas/lookup', async (request, response) => {
    const requestedCodes = request.query.areaCode;
    const codes = [
      ...new Set(Array.isArray(requestedCodes) ? requestedCodes : [requestedCodes]),
    ].filter((code): code is string => typeof code === 'string' && /^[A-Z0-9]+$/i.test(code));

    if (codes.length === 0) {
      response.status(400).json({ error: 'area_code_required' });
      return;
    }

    response.status(200).json(await areas.listByCodes(codes));
  });

  router.get('/api/areas/search', async (request, response) => {
    const { q, limit } = request.query;
    const query = typeof q === 'string' ? q.trim().slice(0, 100) : '';

    if (!query) {
      response.status(400).json({ error: 'q_required' });
      return;
    }

    const capped =
      typeof limit === 'string' && /^[1-9]\d*$/.test(limit) ? Math.min(Number(limit), 100) : 50;
    response.status(200).json(await areas.search(query, capped));
  });

  router.get('/api/areas/parents', async (request, response) => {
    const requestedCodes = request.query.areaCode;
    const codes = [
      ...new Set(Array.isArray(requestedCodes) ? requestedCodes : [requestedCodes]),
    ].filter((code): code is string => typeof code === 'string' && /^[A-Z0-9]+$/i.test(code));
    const parentType = request.query.parentType;

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
    // De-duplicated and capped: each name costs a query, so the URL is not trusted.
    const pick = (value: unknown) =>
      [
        ...new Set(
          (Array.isArray(value) ? value : [value]).filter(
            (entry): entry is string =>
              typeof entry === 'string' && entry !== '' && entry.length <= 100,
          ),
        ),
      ].slice(0, 20);
    const areaTypeNames = pick(request.query.areaType);
    const displayGroups = pick(request.query.displayGroup);

    if (areaTypeNames.length === 0 && displayGroups.length === 0) {
      response.status(400).json({ error: 'area_type_or_display_group_required' });
      return;
    }

    // An unknown type or group is an empty group, not an error — the caller cannot know
    // which exist without asking. Asking by repeated parameter always answers with groups,
    // so a caller's parsing does not change with how many it happened to ask for.
    const groups = await Promise.all([
      ...areaTypeNames.map(async (name) => ({
        areaType: name,
        areas: await areas.listByType(name),
      })),
      ...displayGroups.map(async (name) => ({
        displayGroup: name,
        areas: await areas.listByGroup(name),
      })),
    ]);

    response.status(200).json(groups);
  });

  return router;
}

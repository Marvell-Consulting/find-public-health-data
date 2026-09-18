import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

import { findGeographyGroups } from '../geography/loader.js';

export async function loadGeography({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const api = context.get(apiContext);

  const level = url.searchParams.get('level') ?? '';
  const groups = await findGeographyGroups(api, {
    level,
    query: url.searchParams.get('q') ?? '',
  });
  return Response.json(level ? { areas: groups.flatMap(({ areas }) => areas) } : { groups });
}

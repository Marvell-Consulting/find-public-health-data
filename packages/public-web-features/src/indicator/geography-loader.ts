import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

import { findGeographyGroups } from '../geography/loader.ts';
import { isIndicatorSegment } from './paths.ts';

export async function loadGeography({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const api = context.get(apiContext);

  const level = url.searchParams.get('level') ?? '';
  const displayGroup = url.searchParams.get('displayGroup') ?? level;
  const indicator = url.searchParams.get('indicator') ?? undefined;
  if (indicator && !isIndicatorSegment(indicator))
    return new Response('Not Found', { status: 404 });
  const groups = await findGeographyGroups(api, {
    level: displayGroup,
    query: url.searchParams.get('q') ?? '',
    indicator,
    publicOnly: url.searchParams.get('scheme') === 'public',
  });
  return Response.json(displayGroup ? { areas: groups.flatMap(({ areas }) => areas) } : { groups });
}

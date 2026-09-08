import { indicatorListResponseSchema } from '@fphd/public-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

/**
 * Resource route behind the add-indicator autocomplete: the browser asks its own origin,
 * and the server asks the API, keeping the API unreachable from the client as everywhere
 * else. No component — the loader's JSON is the whole response.
 */
export async function loader({ context, request }: LoaderFunctionArgs) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (!query) {
    return Response.json({ indicators: [] });
  }
  const api = context.get(apiContext);
  return Response.json(
    await api.get(`/api/indicators?q=${encodeURIComponent(query)}`, indicatorListResponseSchema),
  );
}

import { indicatorIdSchema } from '@fphd/internal-api-features/contract';
import type { LoaderFunctionArgs } from 'react-router';

/** An `:id` that is not an indicator id names nothing, so it is a 404 rather than an API error. */
export function requireIndicatorId(params: LoaderFunctionArgs['params']): string {
  const id = indicatorIdSchema.safeParse(params.id);

  if (!id.success) throw new Response('Not Found', { status: 404 });

  return id.data;
}

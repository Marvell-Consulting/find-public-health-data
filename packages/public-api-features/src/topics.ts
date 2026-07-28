import type { Repositories, Topic } from '@fphd/db';
import { Router } from 'express';

/**
 * The wire shape of a topic in a list response. Deliberately not the database row type:
 * `id` is internal, and the API contract should not move every time the table does.
 */
export interface TopicSummary {
  slug: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

function toSummary({ slug, title, createdAt, updatedAt }: Topic): TopicSummary {
  return { slug, title, createdAt, updatedAt };
}

/**
 * Topics are public data, so both APIs mount this unchanged — internal-api is a superset of
 * the public surface by mounting the same routers, not by re-declaring them.
 */
export function topicsRouter(topics: Repositories['topics']): Router {
  const router = Router();

  router.get('/api/topics', async (_request, response) => {
    response.status(200).json((await topics.list()).map(toSummary));
  });

  return router;
}

import type { Repositories, Topic } from '@fphd/db';
import { Router } from 'express';

import type { TopicDetail, TopicSummary } from './contract.js';

function toSummary({ slug, title, createdAt, updatedAt }: Topic): TopicSummary {
  return {
    slug,
    title,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function toDetail(topic: Topic): TopicDetail {
  return { ...toSummary(topic), description: topic.description };
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

  router.get('/api/topics/:slug', async (request, response) => {
    const topic = await topics.findBySlug(request.params.slug);

    if (!topic) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    response.status(200).json(toDetail(topic));
  });

  return router;
}

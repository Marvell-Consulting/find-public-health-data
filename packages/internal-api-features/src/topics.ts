import { requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import type { Topic } from '@fphd/db';
import { Router } from 'express';

import {
  type TopicAdminDetail,
  type TopicAdminSummary,
  toFieldErrors,
  topicIdSchema,
  topicUpdateSchema,
} from './contract.js';
import type { InternalTopicRepository } from './repositories.js';

function toSummary({ id, slug, title, createdAt, updatedAt }: Topic): TopicAdminSummary {
  return {
    id,
    slug,
    title,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function toDetail(topic: Topic): TopicAdminDetail {
  return { ...toSummary(topic), description: topic.description };
}

/**
 * The publisher's view of topics: the same rows the public API serves, plus the ids a write
 * needs to address. Mounted only by `internal-api`; `public-api` must 404 every path here.
 */
export function internalTopicsRouter(
  topics: InternalTopicRepository,
  session: JwtSessionVerifier,
): Router {
  const router = Router();
  const requirePublisher = requireJwtRole(session, 'publisher');

  router.get('/api/internal/topics', requirePublisher, async (_request, response) => {
    response.status(200).json((await topics.list()).map(toSummary));
  });

  router.post('/api/internal/topics', requirePublisher, async (request, response) => {
    // Validated here as well as at the form: the API is reachable without going through it.
    const submission = topicUpdateSchema.safeParse(request.body);

    if (!submission.success) {
      response
        .status(400)
        .json({ error: 'validation_failed', fieldErrors: toFieldErrors(submission.error) });
      return;
    }

    const result = await topics.create(submission.data);

    if (!result.ok) {
      response
        .status(409)
        .json({ error: 'slug_taken', fieldErrors: { slug: 'This slug is already used' } });
      return;
    }

    response.status(201).json({ topic: toDetail(result.topic) });
  });

  router.get('/api/internal/topics/:id', requirePublisher, async (request, response) => {
    const id = topicIdSchema.safeParse(request.params.id);

    // Handing an unparseable id to the database would surface as a 500; it is a bad request.
    if (!id.success) {
      response.status(400).json({ error: 'invalid_id' });
      return;
    }

    const topic = await topics.findById(id.data);

    if (!topic) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    response.status(200).json(toDetail(topic));
  });

  router.put('/api/internal/topics/:id', requirePublisher, async (request, response) => {
    const id = topicIdSchema.safeParse(request.params.id);

    if (!id.success) {
      response.status(400).json({ error: 'invalid_id' });
      return;
    }

    // Validated for the same reason as the create above.
    const submission = topicUpdateSchema.safeParse(request.body);

    if (!submission.success) {
      response
        .status(400)
        .json({ error: 'validation_failed', fieldErrors: toFieldErrors(submission.error) });
      return;
    }

    const result = await topics.update(id.data, submission.data);

    if (!result.ok) {
      if (result.reason === 'not_found') {
        response.status(404).json({ error: 'not_found' });
        return;
      }

      response
        .status(409)
        .json({ error: 'slug_taken', fieldErrors: { slug: 'This slug is already used' } });
      return;
    }

    response.status(200).json({ changed: result.changed, topic: toDetail(result.topic) });
  });

  router.delete('/api/internal/topics/:id', requirePublisher, async (request, response) => {
    const id = topicIdSchema.safeParse(request.params.id);

    if (!id.success) {
      response.status(400).json({ error: 'invalid_id' });
      return;
    }

    const result = await topics.delete(id.data);

    if (!result.ok) {
      response.status(404).json({ error: 'not_found' });
      return;
    }

    response.status(204).end();
  });

  return router;
}

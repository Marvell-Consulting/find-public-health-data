import { requireApiSession, requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { Router } from 'express';

import { indicatorIdSchema, toFieldErrors } from './contract.ts';
import type { IndicatorDraftAttributes, IndicatorDraftVersion } from './indicator-repository.ts';
import type { IndicatorSection } from './indicator-section-contract.ts';
import type { InternalIndicatorRepository } from './repositories.ts';

/** The draft columns a section writes: never the name, whose slug is the name page's concern. */
export type IndicatorSectionAttributes = Omit<IndicatorDraftAttributes, 'name'>;

/** How a section's answers map onto the draft's columns, in both directions. */
export interface IndicatorSectionColumns<Field extends string, Values> {
  fromDraft(draft: IndicatorDraftVersion): Record<Field, string | null>;
  toAttributes(values: Values): IndicatorSectionAttributes;
}

/**
 * GET and PUT `/api/internal/indicators/:id/<key>` for one section of a draft. A PUT writes
 * every answer or, when any is refused, nothing. A published indicator is edited by opening a
 * draft first, so until then the section does not exist: 404 `no_draft`, told apart from an
 * indicator that does not exist at all.
 */
export function indicatorSectionRouter<Field extends string, Values>(
  indicators: InternalIndicatorRepository,
  session: JwtSessionVerifier,
  section: IndicatorSection<Field, Values>,
  columns: IndicatorSectionColumns<Field, Values>,
): Router {
  const router = Router();
  const requirePublisher = requireJwtRole(session, 'publisher');
  const path = `/api/internal/indicators/:id/${section.key}`;

  router.get(path, requirePublisher, async (request, response) => {
    const id = indicatorIdSchema.safeParse(request.params.id);

    if (!id.success) {
      response.status(400).json({ error: 'invalid_id' });
      return;
    }

    const row = await indicators.findDraftState(id.data);

    if (!row?.draft) {
      response.status(404).json({ error: row ? 'no_draft' : 'not_found' });
      return;
    }

    response.status(200).json(columns.fromDraft(row.draft));
  });

  router.put(path, requirePublisher, async (request, response) => {
    const id = indicatorIdSchema.safeParse(request.params.id);

    if (!id.success) {
      response.status(400).json({ error: 'invalid_id' });
      return;
    }

    // Validated here as well as at the form: the API is reachable without going through it.
    const submission = section.schema.safeParse(request.body);

    if (!submission.success) {
      response.status(400).json({
        error: 'validation_failed',
        fieldErrors: toFieldErrors(submission.error, section.fields.options),
      });
      return;
    }

    const { sub } = requireApiSession(response);
    const attributes = columns.toAttributes(submission.data);
    const result = await indicators.updateDraft(id.data, attributes, {}, sub);

    // With no name in the write there is no slug to collide on, so a refusal means no draft.
    if (!result.ok) {
      const exists = (await indicators.findDraftState(id.data)) !== undefined;
      response.status(404).json({ error: exists ? 'no_draft' : 'not_found' });
      return;
    }

    const row = await indicators.findDraftState(id.data);

    if (!row?.draft) throw new Error('the draft just saved could not be read back');

    request.log.info(
      { indicatorId: row.id, shortId: row.shortId, section: section.key },
      'Indicator section saved',
    );
    response.status(200).json(columns.fromDraft(row.draft));
  });

  return router;
}

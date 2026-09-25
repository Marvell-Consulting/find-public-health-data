import { requireApiSession, requireJwtRole } from '@fphd/api-server';
import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { Router } from 'express';

import { indicatorIdSchema, toFieldErrors } from './contract.ts';
import type {
  IndicatorDraft,
  IndicatorDraftAttributes,
  IndicatorDraftLists,
} from './indicator-repository.ts';
import type {
  DetailedQuestion,
  IndicatorSection,
  IndicatorSectionFields,
} from './indicator-section-contract.ts';
import type { InternalIndicatorRepository } from './repositories.ts';

/** The draft columns a section writes: never the name, whose slug is the name page's concern. */
export type IndicatorSectionAttributes = Omit<IndicatorDraftAttributes, 'name'>;

/** The draft columns and lists the sections read; each section adds the ones its form writes. */
export type IndicatorSectionDraft = Pick<
  IndicatorDraft,
  | 'definition'
  | 'rationale'
  | 'polarity'
  | 'methodology'
  | 'calculatedBy'
  | 'calculatedByOther'
  | 'ciMethodId'
  | 'ciMethodModified'
  | 'ciMethodModifications'
  | 'ciMethodOtherDetail'
  | 'updateFrequency'
  | 'disclosureControl'
  | 'disclosureControlDetail'
  | 'roundingApplied'
  | 'roundingDetail'
  | 'caveatsNeeded'
  | 'caveatsDetail'
  | 'otherNotesNeeded'
  | 'otherNotesDetail'
  | 'scheduledPublishAtUk'
  | 'hasLinks'
  | 'links'
  | 'variation'
  | 'qualityAssurance'
  | 'sourceDataIssues'
  | 'sourceDataIssuesDetail'
>;

/**
 * How a section's answers map onto the draft's columns and lists, in both directions. The
 * answers are each field's text, or null, unless the section says otherwise.
 */
export interface IndicatorSectionColumns<
  Field extends string,
  Values,
  Answers = Record<Field, string | null>,
> {
  fromDraft(draft: IndicatorSectionDraft): Answers;
  toAttributes(values: Values): IndicatorSectionAttributes;
  /** For a section that also writes lists; one it returns replaces the draft's. */
  toLists?(values: Values): IndicatorDraftLists;
}

/** The draft's text columns, which a field of the same name reads and writes as it is. */
type TextColumn = {
  [Column in keyof IndicatorSectionDraft]: IndicatorSectionDraft[Column] extends string | null
    ? Column
    : never;
}[keyof IndicatorSectionDraft];

/** For a section whose every field is the draft column of the same name. */
export function sameNamedColumns<
  Field extends TextColumn,
  Values extends IndicatorSectionAttributes,
>(fields: IndicatorSectionFields<Field>): IndicatorSectionColumns<Field, Values> {
  return {
    fromDraft: (draft) =>
      Object.fromEntries(fields.options.map((field) => [field, draft[field]])) as Record<
        Field,
        string | null
      >,
    toAttributes: (values) => values,
  };
}

/** The draft's yes/no columns, which a form answers "yes" or "no". */
type BooleanColumn = {
  [Column in keyof IndicatorSectionDraft]: IndicatorSectionDraft[Column] extends boolean | null
    ? Column
    : never;
}[keyof IndicatorSectionDraft];

/** A stored yes/no as the form answers it. */
export function yesNoAnswer(answer: boolean | null): 'yes' | 'no' | null {
  if (answer === null) return null;
  return answer ? 'yes' : 'no';
}

/** A detail is kept beside a yes alone, whatever the form sent. */
export function detailOf(answer: string, detail: string): string | null {
  return answer === 'yes' ? detail : null;
}

/** Nothing, or a property naming the yes/no columns no question answers, which fails the call. */
type Asks<Unasked extends string> = [Unasked] extends [never]
  ? unknown
  : { yesNoWithoutQuestion: Unasked };

/**
 * For a section whose every field is the draft column of the same name: text as it is, and
 * each yes/no question stored as a boolean, its details kept beside a yes alone. The questions
 * are the ones the section's schema requires details for; a yes/no column no question names
 * does not compile.
 */
export function yesNoDetailColumns<
  Field extends TextColumn | BooleanColumn,
  Values extends Record<Field, string>,
  Question extends DetailedQuestion<Field & BooleanColumn, Field & TextColumn>,
>(
  section: IndicatorSection<Field, Values>,
  questions: readonly Question[] & Asks<Exclude<Extract<Field, BooleanColumn>, Question['answer']>>,
): IndicatorSectionColumns<Field, Values> {
  const answers = new Set<Field>(questions.map(({ answer }) => answer));
  const isAnswer = (field: Field): field is Question['answer'] => answers.has(field);
  const answerOf = new Map<Field, Question['answer']>(
    questions.map(({ answer, detail }) => [detail, answer]),
  );

  return {
    fromDraft: (draft) =>
      Object.fromEntries(
        section.fields.options.map((field) => [
          field,
          isAnswer(field) ? yesNoAnswer(draft[field]) : draft[field],
        ]),
      ) as Record<Field, string | null>,
    toAttributes: (values) =>
      Object.fromEntries(
        section.fields.options.map((field) => {
          const answer = answerOf.get(field);

          if (isAnswer(field)) return [field, values[field] === 'yes'];
          return [field, answer ? detailOf(values[answer], values[field]) : values[field]];
        }),
      ) as IndicatorSectionAttributes,
  };
}

/**
 * GET and PUT `/api/internal/indicators/:id/<key>` for one section of a draft. A PUT writes
 * every answer or, when any is refused, nothing. A published indicator is edited by opening a
 * draft first, so until then the section does not exist: 404 `no_draft`, told apart from an
 * indicator that does not exist at all.
 */
export function indicatorSectionRouter<Field extends string, Values, Input, Answers>(
  indicators: InternalIndicatorRepository,
  session: JwtSessionVerifier,
  section: IndicatorSection<Field, Values, Input>,
  columns: IndicatorSectionColumns<Field, Values, Answers>,
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
    // Async, because a section's API-side schema may check an answer against a lookup.
    const submission = await section.schema.safeParseAsync(request.body);

    if (!submission.success) {
      response.status(400).json({
        error: 'validation_failed',
        fieldErrors: toFieldErrors(submission.error, section.fields.options),
      });
      return;
    }

    const { sub } = requireApiSession(response);
    const attributes = columns.toAttributes(submission.data);
    const lists = columns.toLists?.(submission.data) ?? {};
    const result = await indicators.updateDraft(id.data, attributes, lists, sub);

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

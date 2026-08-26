import {
  type TopicFieldErrors,
  topicAdminDetailSchema,
  topicAdminSummaryListSchema,
  topicCreateResponseSchema,
  topicIdSchema,
  topicUpdateErrorSchema,
  topicUpdateResponseSchema,
} from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { setFlash, takeFlash } from '@fphd/web-server/flash';
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from 'react-router';

import { parseTopicForm, readTopicForm, type TopicFormValues } from './topic-form.js';

export type { TopicAdminDetail, TopicAdminSummary } from '@fphd/internal-api-features/contract';

/**
 * Kept free of any @fphd/ui import so it can be unit-tested without the jsdom/SSR environment
 * the GOV.UK component library needs, matching `topics-loader.ts` on the public side.
 */
export const TOPICS_ADMIN_PATH = '/manage/topics';

/** Resolved on the server so a cookie value is only ever a key into copy written here. */
const FLASH_MESSAGES = {
  'topic-created': 'Topic created',
  'topic-updated': 'Topic updated',
  'topic-unchanged': 'No changes were made',
  'topic-deleted': 'Topic deleted',
} as const;

type FlashKey = keyof typeof FLASH_MESSAGES;

// `in` would also admit inherited keys like 'constructor', turning the lookup into a function.
function isFlashKey(value: string | undefined): value is FlashKey {
  return value !== undefined && Object.hasOwn(FLASH_MESSAGES, value);
}

/** The blank-form page a create posts back to. A literal, so it cannot collide with an id. */
export const NEW_TOPIC_PATH = `${TOPICS_ADMIN_PATH}/new`;

export function editTopicPath(id: string): string {
  return `${TOPICS_ADMIN_PATH}/${encodeURIComponent(id)}`;
}

export function deleteTopicPath(id: string): string {
  return `${editTopicPath(id)}/delete`;
}

/**
 * `:id` matches any segment, so a hand-typed URL can reach here with something that is not an
 * id at all. That is a page which does not exist, not a bad gateway — which is what letting it
 * through to the API would produce, since the API answers a malformed id with a 400.
 */
function requireTopicId(params: LoaderFunctionArgs['params']): string {
  const id = topicIdSchema.safeParse(params.id);

  if (!id.success) throw new Response('Not Found', { status: 404 });

  return id.data;
}

export async function loadAdminTopics({ context }: LoaderFunctionArgs) {
  const flash = takeFlash(context);

  return {
    topics: await context.get(apiContext).get('/api/internal/topics', topicAdminSummaryListSchema),
    notification: isFlashKey(flash) ? FLASH_MESSAGES[flash] : undefined,
  };
}

export async function loadAdminTopic({ context, params }: LoaderFunctionArgs) {
  const id = requireTopicId(params);
  const topic = await context
    .get(apiContext)
    .get(apiPath`/api/internal/topics/${id}`, topicAdminDetailSchema);
  const flash = takeFlash(context);

  return {
    topic,
    notification: isFlashKey(flash) ? FLASH_MESSAGES[flash] : undefined,
  };
}

export interface SaveTopicFailure {
  values: TopicFormValues;
  fieldErrors: TopicFieldErrors;
}

/**
 * On success this redirects to the same edit URL rather than rendering, so a refresh does not
 * re-submit and the outcome arrives as a flash on the next request. Editing the slug therefore
 * leaves the publisher exactly where they were — the write is addressed by id.
 */
export async function saveTopic({
  context,
  params,
  request,
}: ActionFunctionArgs): Promise<SaveTopicFailure | Response> {
  const id = requireTopicId(params);
  const formData = await request.formData();
  const submission = parseTopicForm(formData);

  if (!submission.ok) {
    return { values: readTopicForm(formData), fieldErrors: submission.fieldErrors };
  }

  const result = await context
    .get(apiContext)
    .put(
      apiPath`/api/internal/topics/${id}`,
      submission.values,
      topicUpdateResponseSchema,
      topicUpdateErrorSchema,
    );

  if (!result.ok) {
    return { values: readTopicForm(formData), fieldErrors: result.error.fieldErrors ?? {} };
  }

  setFlash(context, result.data.changed ? 'topic-updated' : 'topic-unchanged');

  return redirect(editTopicPath(id));
}

/**
 * Create a topic, then redirect to its edit page so a refresh does not re-submit and the
 * publisher lands where they can review or keep editing the new topic — the same
 * redirect-and-flash shape a save uses. The id is minted by the database and read back from
 * the response.
 */
export async function createTopic({
  context,
  request,
}: ActionFunctionArgs): Promise<SaveTopicFailure | Response> {
  const formData = await request.formData();
  const submission = parseTopicForm(formData);

  if (!submission.ok) {
    return { values: readTopicForm(formData), fieldErrors: submission.fieldErrors };
  }

  const result = await context
    .get(apiContext)
    .post(
      '/api/internal/topics',
      submission.values,
      topicCreateResponseSchema,
      topicUpdateErrorSchema,
    );

  if (!result.ok) {
    return { values: readTopicForm(formData), fieldErrors: result.error.fieldErrors ?? {} };
  }

  setFlash(context, 'topic-created');

  return redirect(editTopicPath(result.data.topic.id));
}

/** The topic a confirmation page is about to delete — fetched only to show what will go. */
export async function loadTopicToDelete({ context, params }: LoaderFunctionArgs) {
  const id = requireTopicId(params);

  return {
    topic: await context
      .get(apiContext)
      .get(apiPath`/api/internal/topics/${id}`, topicAdminDetailSchema),
  };
}

/**
 * Delete a topic and return to the list with a flash. The confirmation page is the guard —
 * this runs only from its POST — so there is nothing to validate here beyond the id, and the
 * API removes the topic together with the indicator links that reference it.
 */
export async function deleteTopic({ context, params }: ActionFunctionArgs): Promise<Response> {
  const id = requireTopicId(params);

  await context.get(apiContext).delete(apiPath`/api/internal/topics/${id}`);

  setFlash(context, 'topic-deleted');

  return redirect(TOPICS_ADMIN_PATH);
}

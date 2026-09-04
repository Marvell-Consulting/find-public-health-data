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

// No @fphd/ui imports here, so the loaders unit-test without the jsdom the components need.
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

export const NEW_TOPIC_PATH = `${TOPICS_ADMIN_PATH}/new`;

export function editTopicPath(id: string): string {
  return `${TOPICS_ADMIN_PATH}/${encodeURIComponent(id)}`;
}

export function deleteTopicPath(id: string): string {
  return `${editTopicPath(id)}/delete`;
}

function requireTopicId(params: LoaderFunctionArgs['params']): string {
  const id = topicIdSchema.safeParse(params.id);

  if (!id.success) throw new Response('Not Found', { status: 404 });

  return id.data;
}

export async function loadAdminTopics({ context }: LoaderFunctionArgs) {
  const topics = await context
    .get(apiContext)
    .get('/api/internal/topics', topicAdminSummaryListSchema);
  // Taken after the fetch, so a failed page load does not consume the message it would show.
  const flash = takeFlash(context);

  return {
    topics,
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
 * Redirects on success so a refresh does not re-submit; the outcome arrives as a flash. The
 * redirect is by id, so editing the slug leaves the publisher where they were.
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

/** Redirects to the new topic's edit page with a flash, the same shape as a save. */
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

export async function loadTopicToDelete({ context, params }: LoaderFunctionArgs) {
  const id = requireTopicId(params);

  return {
    topic: await context
      .get(apiContext)
      .get(apiPath`/api/internal/topics/${id}`, topicAdminDetailSchema),
  };
}

/** The confirmation page is the guard: this runs only from its POST, so only the id is checked. */
export async function deleteTopic({ context, params }: ActionFunctionArgs): Promise<Response> {
  const id = requireTopicId(params);

  await context.get(apiContext).delete(apiPath`/api/internal/topics/${id}`);

  setFlash(context, 'topic-deleted');

  return redirect(TOPICS_ADMIN_PATH);
}

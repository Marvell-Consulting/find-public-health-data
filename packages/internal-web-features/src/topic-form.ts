import {
  type TopicFieldErrors,
  type TopicUpdate,
  toFieldErrors,
  topicUpdateSchema,
} from '@fphd/internal-api-features/contract';

export interface TopicFormValues {
  title: string;
  slug: string;
  description: string;
}

export type TopicFormResult =
  | { ok: true; values: TopicUpdate }
  | { ok: false; fieldErrors: TopicFieldErrors };

const EMPTY_FORM: TopicFormValues = { title: '', slug: '', description: '' };

/**
 * What the publisher typed, exactly as typed. The form is re-rendered from this on a failed
 * save, so it keeps the raw strings rather than the trimmed values the API would store.
 */
export function readTopicForm(formData: FormData): TopicFormValues {
  const read = (name: keyof TopicFormValues) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : EMPTY_FORM[name];
  };

  return { title: read('title'), slug: read('slug'), description: read('description') };
}

/**
 * The same schema the API applies, run here first so an invalid submission re-renders the
 * form without a round trip — and, with JavaScript off, without one either. The API validates
 * again because it cannot trust a caller.
 */
export function parseTopicForm(formData: FormData): TopicFormResult {
  const result = topicUpdateSchema.safeParse(readTopicForm(formData));

  return result.success
    ? { ok: true, values: result.data }
    : { ok: false, fieldErrors: toFieldErrors(result.error) };
}

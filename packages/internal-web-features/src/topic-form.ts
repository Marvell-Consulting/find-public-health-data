import {
  type TopicFieldErrors,
  type TopicUpdate,
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
 *
 * One message per field: a slug that is both empty and malformed breaks two rules, and a
 * control shows one error.
 */
export function parseTopicForm(formData: FormData): TopicFormResult {
  const result = topicUpdateSchema.safeParse(readTopicForm(formData));

  if (result.success) return { ok: true, values: result.data };

  const fieldErrors: TopicFieldErrors = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];

    if (typeof field === 'string' && !(field in fieldErrors)) {
      Object.assign(fieldErrors, { [field]: issue.message });
    }
  }

  return { ok: false, fieldErrors };
}

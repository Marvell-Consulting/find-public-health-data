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

/** The raw strings as typed, so a failed save re-renders the form exactly as submitted. */
export function readTopicForm(formData: FormData): TopicFormValues {
  const read = (name: keyof TopicFormValues) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : EMPTY_FORM[name];
  };

  return { title: read('title'), slug: read('slug'), description: read('description') };
}

/** The API's schema, applied here first so an invalid submission re-renders with no round trip. */
export function parseTopicForm(formData: FormData): TopicFormResult {
  const result = topicUpdateSchema.safeParse(readTopicForm(formData));

  return result.success
    ? { ok: true, values: result.data }
    : { ok: false, fieldErrors: toFieldErrors(result.error) };
}

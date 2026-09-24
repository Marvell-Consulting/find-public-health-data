import { backLinkHandle } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';

import type { FormFailure, FormValues } from './indicator-section.ts';
import type { SectionPageProps } from './indicator-section-form.tsx';
import { indicatorTaskListPath } from './publish-paths.ts';

/** Every section page links back to its draft's task list. */
export const sectionBackLinkHandle = backLinkHandle<{ id: string }>(({ id }) =>
  indicatorTaskListPath(id),
);

/** The draft's answers, or what was typed and why it was refused after a rejected submission. */
export function useSectionForm<Field extends string>(): SectionPageProps<Field> {
  const { values } = useLoaderData<{ values: FormValues<Field> }>();
  const rejected = useActionData<FormFailure<Field> | undefined>();

  return { fieldErrors: rejected?.fieldErrors, values: rejected?.values ?? values };
}

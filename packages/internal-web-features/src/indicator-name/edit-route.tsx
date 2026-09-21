import { createDocumentMeta } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';
import { indicatorTaskListPath } from '../indicator-task-list/paths.ts';
import { type IndicatorNameFailure, loadIndicatorName, saveIndicatorName } from './loader.ts';
import { INDICATOR_NAME_HEADING, IndicatorNamePage } from './page.tsx';

export const loader = loadIndicatorName;

export const action = saveIndicatorName;

export const meta = createDocumentMeta(INDICATOR_NAME_HEADING);

export function EditIndicatorNameRoute() {
  const { indicator } = useLoaderData<typeof loader>();
  const rejected = useActionData<IndicatorNameFailure | undefined>();

  return (
    <IndicatorNamePage
      back={{ href: indicatorTaskListPath(indicator.id), label: 'Back to task list' }}
      fieldErrors={rejected?.fieldErrors}
      name={rejected?.name ?? indicator.name}
    />
  );
}

export default EditIndicatorNameRoute;

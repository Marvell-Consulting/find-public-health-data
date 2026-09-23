import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';

import type { FormFailure } from '../indicator-section.ts';
import { indicatorTaskListPath } from '../publish-paths.ts';
import {
  type ConfidenceIntervalsField,
  loadConfidenceIntervals,
  saveConfidenceIntervals,
} from './loader.ts';
import { ConfidenceIntervalsPage } from './page.tsx';

export const loader = loadConfidenceIntervals;

export const action = saveConfidenceIntervals;

export const meta = titleFromPage;

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ id }) =>
  indicatorTaskListPath(id),
);

export function ConfidenceIntervalsRoute() {
  const { methods, values } = useLoaderData<typeof loader>();
  const rejected = useActionData<FormFailure<ConfidenceIntervalsField> | undefined>();

  return (
    <ConfidenceIntervalsPage
      fieldErrors={rejected?.fieldErrors}
      methods={methods}
      values={rejected?.values ?? values}
    />
  );
}

export default ConfidenceIntervalsRoute;

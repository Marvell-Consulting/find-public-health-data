import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';

import type { FormFailure } from '../indicator-section.ts';
import { indicatorTaskListPath } from '../publish-paths.ts';
import {
  type DefinitionAndRationaleField,
  loadDefinitionAndRationale,
  saveDefinitionAndRationale,
} from './loader.ts';
import { DefinitionAndRationalePage } from './page.tsx';

export const loader = loadDefinitionAndRationale;

export const action = saveDefinitionAndRationale;

export const meta = titleFromPage;

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ id }) =>
  indicatorTaskListPath(id),
);

export function DefinitionAndRationaleRoute() {
  const { values } = useLoaderData<typeof loader>();
  const rejected = useActionData<FormFailure<DefinitionAndRationaleField> | undefined>();

  return (
    <DefinitionAndRationalePage
      fieldErrors={rejected?.fieldErrors}
      values={rejected?.values ?? values}
    />
  );
}

export default DefinitionAndRationaleRoute;

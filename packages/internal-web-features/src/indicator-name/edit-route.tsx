import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';
import { indicatorTaskListPath } from '../publish-paths.ts';
import { type IndicatorNameFailure, loadIndicatorName, saveIndicatorName } from './loader.ts';
import { IndicatorNamePage } from './page.tsx';

export const loader = loadIndicatorName;

export const action = saveIndicatorName;

export const meta = titleFromPage;

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ indicator }) =>
  indicatorTaskListPath(indicator.id),
);

export function EditIndicatorNameRoute() {
  const { indicator } = useLoaderData<typeof loader>();
  const rejected = useActionData<IndicatorNameFailure | undefined>();

  return (
    <IndicatorNamePage
      fieldErrors={rejected?.fieldErrors}
      name={rejected?.values.name ?? indicator.name}
    />
  );
}

export default EditIndicatorNameRoute;

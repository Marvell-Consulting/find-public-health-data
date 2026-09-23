import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';

import type { FormFailure } from '../indicator-section.ts';
import { indicatorTaskListPath } from '../publish-paths.ts';
import { type CalculationField, loadCalculation, saveCalculation } from './loader.ts';
import { CalculationPage } from './page.tsx';

export const loader = loadCalculation;

export const action = saveCalculation;

export const meta = titleFromPage;

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ id }) =>
  indicatorTaskListPath(id),
);

export function CalculationRoute() {
  const { values } = useLoaderData<typeof loader>();
  const rejected = useActionData<FormFailure<CalculationField> | undefined>();

  return (
    <CalculationPage fieldErrors={rejected?.fieldErrors} values={rejected?.values ?? values} />
  );
}

export default CalculationRoute;

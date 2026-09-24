import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';

import type { FormFailure } from '../indicator-section.ts';
import { indicatorTaskListPath } from '../publish-paths.ts';
import { loadPolarity, type PolarityField, savePolarity } from './loader.ts';
import { PolarityPage } from './page.tsx';

export const loader = loadPolarity;

export const action = savePolarity;

export const meta = titleFromPage;

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ id }) =>
  indicatorTaskListPath(id),
);

export function PolarityRoute() {
  const { values } = useLoaderData<typeof loader>();
  const rejected = useActionData<FormFailure<PolarityField> | undefined>();

  return <PolarityPage fieldErrors={rejected?.fieldErrors} values={rejected?.values ?? values} />;
}

export default PolarityRoute;

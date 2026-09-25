import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData } from 'react-router';
import { DASHBOARD_PATH } from '../dashboard/paths.ts';
import { createIndicator, type IndicatorNameFailure } from './loader.ts';
import { IndicatorNamePage } from './page.tsx';

export const action = createIndicator;

export const meta = titleFromPage;

export const handle = backLinkHandle(DASHBOARD_PATH);

export function NewIndicatorRoute() {
  const rejected = useActionData<IndicatorNameFailure | undefined>();

  return (
    <IndicatorNamePage
      fieldErrors={rejected?.fieldErrors}
      formError={rejected?.formError}
      name={rejected?.values.name}
    />
  );
}

export default NewIndicatorRoute;

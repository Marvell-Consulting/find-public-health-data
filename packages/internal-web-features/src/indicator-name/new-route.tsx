import { backLinkHandle, createDocumentMeta } from '@fphd/ui';
import { useActionData } from 'react-router';
import { DASHBOARD_PATH } from '../dashboard/paths.ts';
import { createIndicator, type IndicatorNameFailure } from './loader.ts';
import { INDICATOR_NAME_HEADING, IndicatorNamePage } from './page.tsx';

export const action = createIndicator;

export const meta = createDocumentMeta(INDICATOR_NAME_HEADING);

export const handle = backLinkHandle(DASHBOARD_PATH);

export function NewIndicatorRoute() {
  const rejected = useActionData<IndicatorNameFailure | undefined>();

  return <IndicatorNamePage fieldErrors={rejected?.fieldErrors} name={rejected?.name} />;
}

export default NewIndicatorRoute;

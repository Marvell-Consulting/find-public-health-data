import { createDocumentMeta } from '@fphd/ui';
import { useActionData } from 'react-router';
import { type CreateIndicatorFailure, createIndicator } from './loader.ts';
import { NEW_INDICATOR_HEADING, NewIndicatorPage } from './page.tsx';

export const action = createIndicator;

export const meta = createDocumentMeta(NEW_INDICATOR_HEADING);

export function NewIndicatorRoute() {
  const rejected = useActionData<CreateIndicatorFailure | undefined>();

  return <NewIndicatorPage fieldErrors={rejected?.fieldErrors} name={rejected?.name} />;
}

export default NewIndicatorRoute;

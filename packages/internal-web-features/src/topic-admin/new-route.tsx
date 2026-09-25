import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData } from 'react-router';
import { createTopic, type SaveTopicFailure } from './loader.ts';
import { NewTopicPage } from './pages.tsx';
import { TOPICS_ADMIN_PATH } from './paths.ts';

export const action = createTopic;

export const meta = titleFromPage;

export const handle = backLinkHandle(TOPICS_ADMIN_PATH);

export function NewTopicRoute() {
  const rejected = useActionData<SaveTopicFailure | undefined>();

  return (
    <NewTopicPage
      fieldErrors={rejected?.fieldErrors}
      formError={rejected?.formError}
      values={rejected?.values}
    />
  );
}

export default NewTopicRoute;

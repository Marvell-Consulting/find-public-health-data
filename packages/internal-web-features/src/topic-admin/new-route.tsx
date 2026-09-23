import { backLinkHandle, createDocumentMeta } from '@fphd/ui';
import { useActionData } from 'react-router';
import { createTopic, type SaveTopicFailure } from './loader.ts';
import { NewTopicPage } from './pages.tsx';
import { TOPICS_ADMIN_PATH } from './paths.ts';

export const action = createTopic;

export const meta = createDocumentMeta('Add a topic');

export const handle = backLinkHandle(TOPICS_ADMIN_PATH);

export function NewTopicRoute() {
  const rejected = useActionData<SaveTopicFailure | undefined>();

  return <NewTopicPage fieldErrors={rejected?.fieldErrors} values={rejected?.values} />;
}

export default NewTopicRoute;

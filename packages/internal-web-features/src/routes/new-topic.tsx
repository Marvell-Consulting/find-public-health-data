import { createDocumentMeta } from '@fphd/ui';
import { useActionData } from 'react-router';

import { NewTopicPage } from '../topic-admin-pages';
import { createTopic, type SaveTopicFailure } from '../topics-admin-loader';

export const action = createTopic;

export const meta = createDocumentMeta('Add a topic');

export function NewTopicRoute() {
  // Present only when a create was rejected, and then it holds what the publisher typed.
  const rejected = useActionData<SaveTopicFailure | undefined>();

  return <NewTopicPage fieldErrors={rejected?.fieldErrors} values={rejected?.values} />;
}

export default NewTopicRoute;

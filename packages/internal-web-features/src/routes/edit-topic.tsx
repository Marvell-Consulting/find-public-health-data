import { createDocumentMeta } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';

import { EditTopicPage } from '../topic-admin-pages';
import { loadAdminTopic, type SaveTopicFailure, saveTopic } from '../topics-admin-loader';

export const loader = loadAdminTopic;
export const action = saveTopic;

export const meta = createDocumentMeta('Edit topic');

export function EditTopicRoute() {
  const { topic, notification } = useLoaderData<typeof loader>();
  // Present only when a save was rejected, and then it holds what the publisher typed —
  // which is what the form must show, not the values still stored.
  const rejected = useActionData<SaveTopicFailure | undefined>();

  return (
    <EditTopicPage
      fieldErrors={rejected?.fieldErrors ?? {}}
      notification={notification}
      values={rejected?.values ?? topic}
    />
  );
}

export default EditTopicRoute;

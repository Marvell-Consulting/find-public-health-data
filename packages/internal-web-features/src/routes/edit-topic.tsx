import { createDocumentMeta } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';

import { EditTopicPage } from '../topic-admin-pages';
import { loadAdminTopic, type SaveTopicFailure, saveTopic } from '../topics-admin-loader';

export const loader = loadAdminTopic;
export const action = saveTopic;

export const meta = createDocumentMeta('Edit topic');

export function EditTopicRoute() {
  const { topic, notification } = useLoaderData<typeof loader>();
  // Set only when a save was rejected; the form then shows what was typed, not what is stored.
  const rejected = useActionData<SaveTopicFailure | undefined>();

  return (
    <EditTopicPage
      fieldErrors={rejected?.fieldErrors ?? {}}
      notification={notification}
      topicId={topic.id}
      values={rejected?.values ?? topic}
    />
  );
}

export default EditTopicRoute;

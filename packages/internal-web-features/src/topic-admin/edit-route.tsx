import { createDocumentMeta } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';
import { loadAdminTopicToEdit, type SaveTopicFailure, saveTopic } from './loader';
import { EditTopicPage } from './pages';

export const loader = loadAdminTopicToEdit;
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

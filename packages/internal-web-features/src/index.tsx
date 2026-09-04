import { A, InsetText, PageIntro } from '@fphd/ui';

import { TOPICS_ADMIN_PATH } from './topics-admin-loader';

export { AdminTopicsRoute } from './routes/admin-topics';
export { DeleteTopicRoute } from './routes/delete-topic';
export { EditTopicRoute } from './routes/edit-topic';
export { NewTopicRoute } from './routes/new-topic';
export {
  AdminTopicsPage,
  DeleteTopicPage,
  EditTopicPage,
  NewTopicPage,
} from './topic-admin-pages';
export { parseTopicForm, readTopicForm, type TopicFormValues } from './topic-form';
export {
  createTopic,
  deleteTopic,
  deleteTopicPath,
  editTopicPath,
  loadAdminTopic,
  loadAdminTopics,
  loadTopicToDelete,
  NEW_TOPIC_PATH,
  type SaveTopicFailure,
  saveTopic,
  TOPICS_ADMIN_PATH,
  type TopicAdminDetail,
  type TopicAdminSummary,
} from './topics-admin-loader';

export function ManageDataPage() {
  return (
    <PageIntro title="Manage public health data">
      <p className="govuk-body-l">
        This route exists only in the internal application. Publishing and administration features
        will be composed here.
      </p>
      <ul className="govuk-list">
        <li>
          <A href={TOPICS_ADMIN_PATH}>Manage topics</A>
        </li>
      </ul>
      <InsetText>Internal feature packages are ready to be added.</InsetText>
    </PageIntro>
  );
}

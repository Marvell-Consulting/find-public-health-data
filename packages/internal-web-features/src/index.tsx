import { A, InsetText, PageIntro } from '@fphd/ui';

import { TOPICS_ADMIN_PATH } from './topics-admin-loader';

export { AdminTopicsRoute } from './routes/admin-topics';
export { EditTopicRoute } from './routes/edit-topic';
export { AdminTopicsPage, EditTopicPage } from './topic-admin-pages';
export { parseTopicForm, readTopicForm, type TopicFormValues } from './topic-form';
export {
  editTopicPath,
  loadAdminTopic,
  loadAdminTopics,
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

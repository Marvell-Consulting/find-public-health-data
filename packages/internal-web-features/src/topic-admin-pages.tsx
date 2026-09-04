import type { TopicFieldErrors } from '@fphd/internal-api-features/contract';
import {
  A,
  BackLink,
  Button,
  ErrorSummary,
  type FieldError,
  formatDate,
  GridColumn,
  GridRow,
  NotificationBanner,
  PageIntro,
  Table,
  Textarea,
  TextInput,
} from '@fphd/ui';

import type { TopicFormValues } from './topic-form';
import {
  deleteTopicPath,
  editTopicPath,
  NEW_TOPIC_PATH,
  TOPICS_ADMIN_PATH,
  type TopicAdminSummary,
} from './topics-admin-loader';

/** Summary order follows the form, so an error summary reads in the order the fields do. */
const FIELD_ORDER = ['title', 'slug', 'description'] as const;

const EMPTY_VALUES: TopicFormValues = { title: '', slug: '', description: '' };

function toErrorSummary(fieldErrors: TopicFieldErrors): FieldError[] {
  return FIELD_ORDER.flatMap((name) => {
    const message = fieldErrors[name];
    return message === undefined ? [] : [{ name, message }];
  });
}

// Two-thirds width: the table needs more than PageIntro's reading measure.
export function AdminTopicsPage({
  topics,
  notification,
}: {
  topics: TopicAdminSummary[];
  notification?: string | undefined;
}) {
  return (
    <GridRow>
      <GridColumn width="two-thirds">
        {notification === undefined ? null : (
          <NotificationBanner type="success">{notification}</NotificationBanner>
        )}
        <h1 className="govuk-heading-xl">Manage topics</h1>
        <Table
          caption="Topics"
          headings={{ title: 'Topic name', slug: 'Slug', updatedAt: 'Last updated' }}
          keys={['title', 'slug', 'updatedAt']}
          data={topics.map((topic) => ({
            title: <A href={editTopicPath(topic.id)}>{topic.title}</A>,
            slug: topic.slug,
            updatedAt: <time dateTime={topic.updatedAt}>{formatDate(topic.updatedAt)}</time>,
          }))}
        />
        <Button href={NEW_TOPIC_PATH}>Add a topic</Button>
      </GridColumn>
    </GridRow>
  );
}

interface TopicFieldsProps {
  fieldErrors: TopicFieldErrors;
  values: TopicFormValues;
  submitLabel: string;
}

// A plain form posting back to its own page, so it behaves the same with and without JavaScript.
function TopicFields({ fieldErrors, values, submitLabel }: TopicFieldsProps) {
  return (
    <form method="post">
      <TextInput
        defaultValue={values.title}
        error={fieldErrors.title}
        label="Topic name"
        name="title"
      />
      <TextInput
        defaultValue={values.slug}
        error={fieldErrors.slug}
        hint="Lowercase letters or numbers, separated by hyphens. It appears in the page address."
        label="Slug"
        name="slug"
      />
      <Textarea
        defaultValue={values.description}
        error={fieldErrors.description}
        label="Description"
        name="description"
      />
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}

interface NewTopicPageProps {
  fieldErrors?: TopicFieldErrors | undefined;
  values?: TopicFormValues | undefined;
}

export function NewTopicPage({ fieldErrors = {}, values = EMPTY_VALUES }: NewTopicPageProps) {
  return (
    <>
      <BackLink href={TOPICS_ADMIN_PATH}>Back to topics</BackLink>
      <ErrorSummary errors={toErrorSummary(fieldErrors)} />
      <PageIntro title="Add a topic">
        <TopicFields fieldErrors={fieldErrors} submitLabel="Create topic" values={values} />
        <p className="govuk-body">
          <A href={TOPICS_ADMIN_PATH}>Return to topic list</A>
        </p>
      </PageIntro>
    </>
  );
}

interface EditTopicPageProps {
  fieldErrors?: TopicFieldErrors;
  notification?: string | undefined;
  topicId: string;
  values: TopicFormValues;
}

export function EditTopicPage({
  fieldErrors = {},
  notification,
  topicId,
  values,
}: EditTopicPageProps) {
  return (
    <>
      <BackLink href={TOPICS_ADMIN_PATH}>Back to topics</BackLink>
      {notification === undefined ? null : (
        <NotificationBanner type="success">{notification}</NotificationBanner>
      )}
      <ErrorSummary errors={toErrorSummary(fieldErrors)} />
      <PageIntro title="Edit topic">
        <TopicFields fieldErrors={fieldErrors} submitLabel="Save" values={values} />
        <p className="govuk-body">
          <A href={deleteTopicPath(topicId)}>Delete topic</A>
        </p>
        <p className="govuk-body">
          <A href={TOPICS_ADMIN_PATH}>Return to topic list</A>
        </p>
      </PageIntro>
    </>
  );
}

export function DeleteTopicPage({ topic }: { topic: TopicAdminSummary }) {
  return (
    <>
      <BackLink href={editTopicPath(topic.id)}>Back to editing</BackLink>
      <PageIntro title="Delete topic">
        <p className="govuk-body">
          Are you sure you want to delete <strong>{topic.title}</strong>? Any indicators linked to
          this topic will be unlinked from it. This cannot be undone.
        </p>
        {/* Plain form so it works without JavaScript; the POST is the confirmation. */}
        <form method="post">
          <Button classModifiers="warning" type="submit">
            Delete topic
          </Button>
        </form>
        <p className="govuk-body">
          <A href={editTopicPath(topic.id)}>Cancel</A>
        </p>
      </PageIntro>
    </>
  );
}

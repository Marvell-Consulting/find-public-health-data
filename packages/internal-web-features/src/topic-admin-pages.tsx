import type { TopicFieldErrors } from '@fphd/internal-api-features/contract';
import {
  A,
  BackLink,
  Button,
  ErrorSummary,
  type FieldError,
  formatDate,
  NotificationBanner,
  PageIntro,
  Table,
  Textarea,
  TextInput,
} from '@fphd/ui';

import type { TopicFormValues } from './topic-form';
import { editTopicPath, TOPICS_ADMIN_PATH, type TopicAdminSummary } from './topics-admin-loader';

/** Summary order follows the form, so an error summary reads in the order the fields do. */
const FIELD_ORDER = ['title', 'slug', 'description'] as const;

function toErrorSummary(fieldErrors: TopicFieldErrors): FieldError[] {
  return FIELD_ORDER.flatMap((name) => {
    const message = fieldErrors[name];
    return message === undefined ? [] : [{ name, message }];
  });
}

export function AdminTopicsPage({ topics }: { topics: TopicAdminSummary[] }) {
  return (
    <PageIntro title="Manage topics">
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
    </PageIntro>
  );
}

interface EditTopicPageProps {
  fieldErrors?: TopicFieldErrors;
  notification?: string | undefined;
  values: TopicFormValues;
}

export function EditTopicPage({ fieldErrors = {}, notification, values }: EditTopicPageProps) {
  return (
    <>
      <BackLink href={TOPICS_ADMIN_PATH}>Back to topics</BackLink>
      {notification === undefined ? null : (
        <NotificationBanner type="success">{notification}</NotificationBanner>
      )}
      <ErrorSummary errors={toErrorSummary(fieldErrors)} />
      <PageIntro title="Edit topic">
        {/* A plain form, not React Router's: the page then behaves identically with and
            without JavaScript, which is the guarantee this service makes. */}
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
          <Button type="submit">Save</Button>
        </form>
        <p className="govuk-body">
          <A href={TOPICS_ADMIN_PATH}>Return to topic list</A>
        </p>
      </PageIntro>
    </>
  );
}

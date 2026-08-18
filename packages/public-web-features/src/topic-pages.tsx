import { CardList, GridColumn, GridRow, PageIntro } from '@fphd/ui';

import type { TopicDetail, TopicSummary } from './topics-loader';

/**
 * Full width rather than PageIntro's reading measure, because the cards need the whole grid to
 * form three columns.
 */
export function TopicsPage({ topics }: { topics: TopicSummary[] }) {
  return (
    <GridRow>
      <GridColumn width="full">
        <h1 className="govuk-heading-xl">Public health topics</h1>
        <CardList
          columns="three"
          headingLevel={2}
          items={topics.map((topic) => ({
            description: topic.description,
            href: `/topics/${topic.slug}`,
            title: topic.title,
          }))}
        />
      </GridColumn>
    </GridRow>
  );
}

export function TopicPage({ topic }: { topic: TopicDetail }) {
  return (
    <PageIntro title={topic.title}>
      <p className="govuk-body">{topic.description}</p>
    </PageIntro>
  );
}

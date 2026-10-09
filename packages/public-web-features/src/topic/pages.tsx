import { Button, CardList, GridColumn, GridRow, Input, Label, PageIntro } from '@fphd/ui';
import { useState } from 'react';

import type { TopicDetail, TopicSummary } from './loader.ts';

/**
 * Full width rather than PageIntro's reading measure, because the cards need the whole grid to
 * form three columns.
 */
export function TopicsPage({
  topics,
  initialQuery = '',
}: {
  topics: TopicSummary[];
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const searchTerm = query.trim().toLowerCase();
  const filteredTopics = topics.filter(
    (topic) =>
      topic.title.toLowerCase().includes(searchTerm) ||
      topic.description.toLowerCase().includes(searchTerm),
  );

  return (
    <GridRow>
      <GridColumn width="full">
        <h1 className="govuk-heading-xl">Public health topics</h1>
        <form
          action="/topics"
          className="govuk-form-group"
          method="get"
          onSubmit={(event) => event.preventDefault()}
        >
          <Label classModifiers="s" htmlFor="topic-search">
            Search for topics
          </Label>
          <Input
            autoComplete="off"
            classModifiers="width-20"
            id="topic-search"
            name="q"
            onChange={(event) => setQuery(event.currentTarget.value)}
            type="search"
            value={query}
          />
          <noscript>
            <Button type="submit">Search</Button>
          </noscript>
        </form>
        <p aria-live="polite" role="status" className="govuk-visually-hidden">
          {filteredTopics.length} {filteredTopics.length === 1 ? 'topic' : 'topics'} found.
        </p>
        {filteredTopics.length ? (
          <CardList
            columns="three"
            headingLevel={2}
            searchTerm={searchTerm}
            items={filteredTopics.map((topic) => ({
              description: topic.description,
              href: `/topics/${topic.slug}`,
              title: topic.title,
            }))}
          />
        ) : (
          <p className="govuk-body">No topics match your search.</p>
        )}
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

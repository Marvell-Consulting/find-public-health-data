import {
  Button,
  CardList,
  GridColumn,
  GridRow,
  Input,
  Label,
  PageIntro,
  searchPattern,
} from '@fphd/ui';
import { useEffect, useRef, useState } from 'react';

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
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const input = formRef.current?.elements.namedItem('q');
    if (input instanceof HTMLInputElement) setQuery(input.value);
  }, []);
  const pattern = searchPattern(query);
  const filteredTopics = pattern
    ? topics.filter((topic) => pattern.test(topic.title) || pattern.test(topic.description))
    : topics;

  return (
    <GridRow>
      <GridColumn width="full">
        <h1 className="govuk-heading-xl">Public health topics</h1>
        <search>
          <form
            ref={formRef}
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
              defaultValue={initialQuery}
              id="topic-search"
              name="q"
              onChange={(event) => setQuery(event.currentTarget.value)}
              type="search"
            />
            <noscript>
              <Button type="submit">Search</Button>
            </noscript>
          </form>
        </search>
        <p role="status" className="govuk-visually-hidden">
          {filteredTopics.length} {filteredTopics.length === 1 ? 'topic' : 'topics'} found.
        </p>
        {filteredTopics.length ? (
          <CardList
            columns="three"
            headingLevel={2}
            searchTerm={query}
            items={filteredTopics.map((topic) => ({
              description: topic.description,
              href: `/topics/${topic.slug}`,
              title: topic.title,
            }))}
          />
        ) : (
          <p className="govuk-body">
            {topics.length ? 'No topics match your search.' : 'No topics are available.'}
          </p>
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

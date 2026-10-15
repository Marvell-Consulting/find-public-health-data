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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigationType, useSearchParams } from 'react-router';

import type { TopicDetail, TopicSummary } from './loader.ts';

/**
 * Full width rather than PageIntro's reading measure, because the cards need the whole grid to
 * form three columns.
 */
export function TopicsPage({ topics }: { topics: TopicSummary[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const query = searchParams.get('q') ?? '';
  const [hydrated, setHydrated] = useState(false);
  const hasHydrated = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const updateQuery = useCallback(
    (value: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set('q', value);
          else next.delete('q');
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );
  useEffect(() => {
    // Input's public props do not expose a typed input ref.
    const input = formRef.current?.elements.namedItem('q');
    if (!(input instanceof HTMLInputElement)) return;
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      setHydrated(true);
      if (input.value !== query) updateQuery(input.value);
    } else if (navigationType !== 'REPLACE') {
      // Typing replacements may still be catching up with newer keystrokes.
      input.value = query;
    }
  }, [navigationType, query, updateQuery]);
  const pattern = searchPattern(query);
  const filteredTopics = pattern
    ? topics.filter((topic) => pattern.test(topic.title) || pattern.test(topic.description))
    : topics;
  const resultCount = topics.length
    ? `${filteredTopics.length} ${filteredTopics.length === 1 ? 'topic' : 'topics'} found.`
    : '';
  const [announcement, setAnnouncement] = useState(resultCount);
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(resultCount), 300);
    return () => clearTimeout(timer);
  }, [query, resultCount]);

  return (
    <GridRow>
      <GridColumn width="full">
        <h1 className="govuk-heading-xl">Public health topics</h1>
        {/* biome-ignore lint/a11y/noRedundantRoles: Explicit landmark supports browsers predating the search element. */}
        <search role="search">
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
              defaultValue={query}
              id="topic-search"
              name="q"
              maxLength={200}
              onChange={(event) => updateQuery(event.currentTarget.value)}
              type="search"
            />
            {!hydrated && <Button type="submit">Search</Button>}
          </form>
        </search>
        <p role="status" className="govuk-visually-hidden">
          {announcement}
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

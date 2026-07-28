import { A, PageIntro } from '@fphd/ui';

import type { TopicDetail, TopicSummary } from './topics-loader';

export function TopicsPage({ topics }: { topics: TopicSummary[] }) {
  return (
    <PageIntro title="Topics">
      <ul className="govuk-list">
        {topics.map((topic) => (
          <li key={topic.slug}>
            <A href={`/topics/${topic.slug}`}>{topic.title}</A>
          </li>
        ))}
      </ul>
    </PageIntro>
  );
}

export function TopicPage({ topic }: { topic: TopicDetail }) {
  return (
    <PageIntro title={topic.title}>
      <p className="govuk-body">{topic.description}</p>
    </PageIntro>
  );
}
